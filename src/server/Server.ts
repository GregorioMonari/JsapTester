const express=require("express")
const bodyParser= require("body-parser")
const log=require("greglogs").default
import { Jsap } from '../types/types'
import JsapTester from '../JsapTools/JsapTester'

export default class Server{

    private app:any;
    private port:number;
    private rootPath:string;

    constructor(_port:number){
        this.port= _port;
        this.rootPath="/api/v1";
        this.app= express();
        this.app.use(bodyParser.json({limit:"25mb"}))
        this.defineRoutes();
    }

    public listen(){
        return new Promise(resolve=>{
            this.app.listen(this.port,()=>{
                log.info("Server listening on port: "+this.port)
                resolve("listening")
            })
        })
    }

    private defineRoutes(){
        this.app.get(this.rootPath+"/ping", (req:any, res:any) =>{
            log.info("Received ping request, responding with pong!")
            res.status(200).send("pong")
        })

        this.app.post(this.rootPath+"/jsapvalidation", async (req:any, res:any)=>{
            const payload= req.body
            if(!payload || typeof payload != typeof {}){
                res.status(500).send({error:"Payload is not a json, malformed or undefined"})
                return
            }
            if(Object.keys(payload).length==0){
                res.status(500).send({error:"Payload is empty"})
                return
            }
            if(!payload.hasOwnProperty("jsap")){
                res.status(500).send({error:"Payload is missing property: \"jsap\""})
                return
            }
            log.info("Received valid jsapvalidation request, payload:",payload)

            try{
                const testResult= await this.validateJsap(payload)
                res.status(200).send(testResult)
            }catch(e){
                res.status(500).send(e)
            }
            
        })

    }

    async validateJsap(payload:any):Promise<any>{
        console.log("[1] IMPORTING JSAP")
        log.info("Parsing jsap...")
        const jsap:Jsap= payload.jsap;
        const config:any= payload.config;

        const tester= new JsapTester(config,{});
        const testResult= await tester.test(jsap);
    
        log.info("TestResult:",testResult)
        return testResult
    }

}





