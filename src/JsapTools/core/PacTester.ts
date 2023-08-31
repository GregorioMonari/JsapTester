import { Jsap, UpdateResponse } from '../../types/types'
const log=require("greglogs").default
import { Consumer, Producer, PacModule } from 'pacfactory'


export default class PacTester{
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

    private validateUpdate(forcedBindings:any,bindingsRes:any):boolean{
        if(bindingsRes.length==1){
            return true
        }else{
            return false
        }
    }

    private async testQueryMapping(queryMapping:any):Promise<any>{
        var counter=0;
        var failed=0;
        var completed=0;
        for(const queryName in queryMapping){
            try{
                log.info("** Test #"+counter+" -> query: "+queryName)
                //INSERT TEST
                //Get queryname and forcedBindings
                const insertName=queryMapping[queryName].insert //NOME DELLA QUERY
                const forcedBindings= this.buildCurrentForcedBindings(insertName,counter);
                //!Clean graph from eventual previous failed tests
                await this.deleteGraphFromSparqlInsert(insertName);
                //Update data
                log.info("- Performing insert test: "+insertName)
                log.trace("Bindings: ",forcedBindings)
                let inserter= new Producer(this.jsap,insertName)
                const updateRes:UpdateResponse = await inserter.updateSepa(forcedBindings)
                log.trace("UpdateRes:",updateRes);
                //Query data
                const bindings={};
                let consumer= new Consumer(this.jsap,queryName,bindings)
                const queryRes= await consumer.querySepa()
                log.trace("QueryRes:",queryRes)
                //Validate data
                if(this.validateUpdate(forcedBindings,queryRes)){
                    log.info("Update Success, consumer received 1 binding!")
                }else{
                    log.info("Error: no binding received")
                    log.info("Forced bindings:",forcedBindings);
                    log.info("Query result:",queryRes);
                    log.info("Update text: "+this.jsap.updates[insertName].sparql)
                    log.info("Query text: "+this.jsap.queries[queryName].sparql)
                    //throw new Error("No binding received!")
                    failed++
                }
    
                //DELETE TEST
                var deleteName=null;
                if(queryMapping[queryName].hasOwnProperty("delete")){
                    if(queryMapping[queryName].delete!=""){
                        deleteName=queryMapping[queryName].delete
                    }
                }
                if(deleteName){
                    log.info("Performing delete test")
                }else{
                    log.info("- Skipping delete test")
                }
                
                //CLEAN GRAPH
                await this.deleteGraphFromSparqlInsert(insertName);
                completed++
            }catch(e:any){
                log.info("ERROR")
                log.debug(e)
                failed++
            }
            counter++
        }
        log.info("----------<TESTS FINISHED>----------")
        log.info("| Completed: "+completed+", failed: "+failed)
        if(failed!=0 || completed!=Object.keys(queryMapping).length){
            return {
                status: "failed",
                failed:failed,
                completed:completed,
                output:""
            }
        }else{
            return {
                status:"success",
                failed:failed,
                completed:completed,
                output:""
            }
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