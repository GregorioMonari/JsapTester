import { Jsap, UpdateResponse } from '../../types/types'
const log=require("greglogs").default
import { Consumer, Producer, PacModule } from 'pacfactory'
import * as fs from 'fs'

export default class SubTester{
    private jsap:Jsap;

    constructor(_jsap:Jsap){
        this.jsap=_jsap
    }

    private isUpdateResponseSuccessful(res:UpdateResponse):boolean{
        var success=false;
        if(res){
            if(typeof res == typeof {}){
                if(res.hasOwnProperty("status")){
                    if(res.hasOwnProperty("statusText")){
                        if(res.status==200 && res.statusText=='OK'){
                            success=true
                        }
                    }
                }
            }
        }
        return success
    }
    private importQueryMapping(){
        if(!this.jsap.extended.hasOwnProperty("jsapQueryMapping")){
            throw new Error("Invalid jsap, missing query mapping")
        }
        const dirtyQueryMapping=this.jsap.extended.jsapQueryMapping;
        log.trace("DirtyQueryMapping:",dirtyQueryMapping)
        return this.cleanDirtyQueryMapping(dirtyQueryMapping)
    }
    private cleanDirtyQueryMapping(dirtyQueryMapping:any){
        //CLEAN DIRTY MAPPING OBJECT
        var queryMapping:any={}
        for(const queryName in dirtyQueryMapping){
            //console.log(queryName)
            const value= dirtyQueryMapping[queryName]
            if(value){
                if(typeof value == typeof {}){
                    if(value.hasOwnProperty("insert")){
                        queryMapping[queryName]=value;
                    }
                }
            }
        }
        const totalQueries= Object.keys(this.jsap.queries).length;
        const totalMappedQueries= Object.keys(queryMapping).length;
        log.info("Imported "+totalMappedQueries+" mappings for "+totalQueries+" queries")
        return queryMapping
    }
    private buildCurrentForcedBindings(insertName:string, counter:number){
        const insertBindings=this.jsap.updates[insertName].forcedBindings;//FORCED BINDINGS
        var forcedBindings:any={}
        Object.keys(insertBindings).forEach(k=>{
            forcedBindings[k]=insertBindings[k].value

            /*
            if(typeof forcedBindings[k] == typeof 10){
                forcedBindings[k]=forcedBindings[k]+counter
            }else{
                if(typeof forcedBindings[k] == typeof "stringa"){

                }else{
                    throw new Error("Unknown forced binding value")
                }
            }
            */
            

        }) 
        return forcedBindings
    }
    private async deleteGraphFromSparqlInsert(insertName:string){
        //CLEAN GRAPH
        const text= this.jsap.updates[insertName].sparql;
        const re= /GRAPH\s+([^ ]+)/;
        const result:any= re.exec(text)
        const graphName=result[1].trim() //NOME DEL GRAFO INTERESSATO
        log.trace("DELETING GRAPH:",graphName)
        var prefixes=""
        Object.keys(this.jsap.namespaces).forEach(k=>{
            //log.info(k)
            prefixes=prefixes+`PREFIX ${k}: <${this.jsap.namespaces[k]}> `
        })
        //console.log(prefixes)
        const deleteGraphText= prefixes+" DROP GRAPH "+graphName
        log.trace(deleteGraphText)
        const graphCleaner= new PacModule(this.jsap)
        const graphDeleteRes:UpdateResponse= await graphCleaner.api.update(deleteGraphText)
        

        var cleaned=this.isUpdateResponseSuccessful(graphDeleteRes)
        if(cleaned){
            log.debug("Cleaned graph:",graphName)
        }else{
            throw new Error("Error cleaning graph: "+graphName)
        }
    }

    private validateUpdate(subResultsArray:any,subNumber:number):boolean{
        log.info(subResultsArray)
        var totalBindingsReceived:number=0;
        for(const subRes of subResultsArray){
            if(subRes.length==1){
                totalBindingsReceived++
            }
        }
        return totalBindingsReceived==subNumber
    }


    private syncCreateConsumer(queryName:string,bindings:any): Promise<Consumer>{

        return new Promise((resolve,reject)=>{
            var consumer= new Consumer(this.jsap,queryName,bindings)
            consumer.getEmitter().on("firstResults",(not:any)=>{
                //console.log("Received first results")
                //console.log("Results:",not._results)
                resolve(consumer)
            })

            consumer.subscribeToSepa()//!START SUBSCRIPTION
        })
    }


    private async warmUpSepa(insertName:string,forcedBindings:any,nUpdates:number){
        for(var j=0; j<nUpdates; j++){
            let inserter= new Producer(this.jsap,insertName)
            const updateRes:UpdateResponse = await inserter.updateSepa(forcedBindings)
        }
        log.info("Finished "+nUpdates+" pre-updates to warm up!")
        await this.deleteGraphFromSparqlInsert(insertName);
    }

    private async testSubNumber(queryName:string, insertName:string, forcedBindings: any, subNumber:number){
        log.info("### TESTING SUB ARR:",subNumber,"###")
        let consumerArr:Consumer[]=[];
        let subResults:any= [];
        const bindings={};
        await this.deleteGraphFromSparqlInsert(insertName);

        //CREATE CONSUMERS ARRAY
        for(var i=0; i<subNumber; i++){
            let consumer= await this.syncCreateConsumer(queryName,bindings)
            consumerArr.push(consumer)
        }

        log.trace("ConsumerArr length:",consumerArr.length)

        //WARM UP
        //await this.warmUpSepa(insertName,forcedBindings,5);

        //ADD EVENT HANDLER
        consumerArr.forEach(consumer=>{
            consumer.getEmitter().on("addedResults",(not:any)=>{
                subResults.push(not._results.bindings)
                log.info("Received new added results notification from Sepa:",subResults)
            })
        })


        //UPDATE
        log.info("- Performing insert test: "+insertName)
        log.trace("Bindings: ",forcedBindings)

        let t0=performance.now() 
        let inserter= new Producer(this.jsap,insertName)
        const updateRes:UpdateResponse = await inserter.updateSepa(forcedBindings)
        let t1=performance.now()
        let timeElapsed=t1-t0;
        log.debug("Update time:",timeElapsed+"ms")

        log.info("Waiting")
        //await sleep(3000)
        log.info("Finished waiting")

        consumerArr.forEach(consumer=>{
            consumer.stop()
        })

        consumerArr=[]; //CLEAN UP

        await this.deleteGraphFromSparqlInsert(insertName);


        //VALIDATE UPDATE
        let success=false;
        if(subResults.length==subNumber){
            log.debug("Success!")
            success=true;
        }

        //CLEAN SUB RESULTS
        subResults=[]

        return {
            success:success,
            timeElapsed:timeElapsed
        }

        /*
        //CREATE SUBSCRIBER AND WARM UP
        for(var i=0; i<subNumber; i++){
            await this.deleteGraphFromSparqlInsert(insertName);


            let consumer = await this.syncCreateConsumer(this.jsap,queryName,bindings)

            for(var j=0; j<5; j++){
                let inserter= new Producer(this.jsap,insertName)
                const updateRes:UpdateResponse = await inserter.updateSepa(forcedBindings)
            }
            log.info("Finished 5 pre-updates to warm up!")
            await this.deleteGraphFromSparqlInsert(insertName);

            consumerArr.push(consumer)
            //console.log("Created Consumer")
            consumer.getEmitter().on("addedResults",(not:any)=>{
                log.info("Added results received!")
                subResults.push(not._results.bindings)
            })

        }


        //!UPDATE
        log.info("- Performing insert test: "+insertName)
        log.trace("Bindings: ",forcedBindings)

        var t0=performance.now() 
        let inserter= new Producer(this.jsap,insertName)
        const updateRes:UpdateResponse = await inserter.updateSepa(forcedBindings)
        var t1=performance.now()
        var timeElapsed=t1-t0;
        log.info("Update time:",timeElapsed+"ms")

        //!SAVE TIME ELAPSED TO PERFORMANCE ARRAY
        performanceRes[queryName][subNumber.toString()]=timeElapsed;

        log.trace("UpdateRes:",updateRes);
        log.trace("SubResults:",subResults)

        //!VALIDATE
        if(this.validateUpdate(subResults,subNumber)){
            log.info("OK") 
            
        }else{
            log.info("ERROR")
            failed++
            throw new Error("Sub error")
        }


        //!REMOVE SUBSCRIPTION
        //log.info(consumerArr[0].get)
        consumerArr.forEach(consumer=>{
            consumer.stop()
        });
        consumerArr=[];

        //!CLEAN GRAPH
        await this.deleteGraphFromSparqlInsert(insertName);
        */
    }

    private getMean(arr:number[]):number{
        const max= Math.max(...arr);
        const min= Math.min(...arr);
        var cleanArr:any=[];
        for(const n of arr){
            if(n!=max && n!=min){
                cleanArr.push(n)
            }
        }
        //log.info(cleanArr)
        var sum=0;
        for(const n of cleanArr){
            sum=sum+n;
        }

        return sum/(cleanArr.length)
    }

    private async testQueryMapping(queryMapping:any):Promise<any>{
        var counter=0;
        var failed=0;
        var completed=0;
        var successCache:any={}
        var performanceRes:any={};
        const subArr=[1,10,50];
        const repeat=10; //repeat each test n times
        log.info("SUBARR:",subArr)


        for(const queryName in queryMapping){
            try{
                log.info(" ")
                log.info("** Test #"+counter+", query: "+queryName)

                //*PREFLIGHT
                //Get queryname and forcedBindings
                const insertName=queryMapping[queryName].insert //NOME DELL'UPDATE
                const forcedBindings= this.buildCurrentForcedBindings(insertName,counter);
                performanceRes[queryName]={}; //create new perf cell for curr query
                successCache[queryName]={}
                //!Clean graph from eventual previous failed tests
                await this.deleteGraphFromSparqlInsert(insertName);
                
                //*TEST FOR EACH SUBNUMBER
                var success=true;
                for(const subNumber of subArr){
                    successCache[queryName][subNumber.toString()]=[]
                    var perfArr:any=[];
                    for(var k=0;k<repeat;k++){
                        log.info("Starting repetition "+k)
                        const res=await this.testSubNumber(queryName, insertName,forcedBindings,subNumber)
                        log.info(res)
                        if(!res.success) {
                            success=false;
                            successCache[queryName][subNumber.toString()][k]=false

                        }else{
                            successCache[queryName][subNumber.toString()][k]=true
                        }
                        perfArr.push(res.timeElapsed)
                        log.info("Completed repetition "+k)
                    }
                    const mean=this.getMean(perfArr)
                    performanceRes[queryName][subNumber.toString()]=mean;
                }

                await this.deleteGraphFromSparqlInsert(insertName);
                log.info("** Finished queryTest, success:"+success)
                if(success){completed++}else{failed++}

            }catch(e:any){
                log.info("ERROR")
                log.info(e)
                failed++
            }
        }
        log.info("----------<TESTS FINISHED>----------")
        log.info("| Completed: "+completed+", failed: "+failed)
        //log.info("| Performance:",performanceRes)

        var status="success"

        if(failed!=0 || completed!=Object.keys(queryMapping).length) status="failed"

        return {
            system:getOsInfo(),
            status:status,
            successCache:successCache,
            output:"",
            performance:performanceRes
        }
        
    }


    public async test():Promise<any>{
        console.log("\n[2] TESTING PAC MODULES")
        log.info("Importing query mappings...")
        const queryMapping= this.importQueryMapping()
        log.info("----------<STARTING TESTS>----------")
        var testResult:any={}
        try{
            testResult= await this.testQueryMapping(queryMapping)
            log.info(JSON.stringify(testResult))
            //fs.writeFileSync("./resources/testResults.json",JSON.stringify(testResult))  //readFileSync(jsapPath,{ encoding: 'utf8', flag: 'r' })
        }catch(e){
            log.info(e)
        }


        if(testResult.status=="failed"){
            log.info("Test failed")
        }else{
            log.info("Test successful!")
        }

        return testResult
    
    }
}




function sleep(time:number){
    return new Promise(resolve => setTimeout(resolve, time));
}


function getOsInfo(){
    const os=require("os")
    return `# System info #
Version: ${os.version()}
Cpu model: ${os.cpus()[0].model}
Cpu speed: ${os.cpus()[0].speed}
Cores: ${os.cpus().length}`
}

console.log(getOsInfo())