var log = require("greglogs").default
import * as fs from 'fs'
import { Jsap } from "../types/types";
import JsapSchemaValidator from './core/JsapSchemaValidator';
//import PacTester from './core/PacTester';
import SubTester from './core/SubTester';

export default class JsapTester{
    private config:any;
    private sepaDefaults:any;
    constructor(config:any,defaults:any){
        this.config=config;
        this.sepaDefaults=defaults;
    }

    public importJsapFromFile():Jsap{
        const config=this.config;

        console.log("IMPORTING JSAP")
        let jsapPath="";
        if(config.jsapPath){
            if(typeof config.jsapPath == typeof "ciao"){
                jsapPath=config.jsapPath as string
            }
        }
    
        //IMPORT JSAP
        log.info("Reading jsap...")
        if(!config.jsapPath){throw new Error("Error, jsapPath cannot be undefined")}
        const rawJsap= fs.readFileSync(jsapPath,{ encoding: 'utf8', flag: 'r' })
        log.info("Imported "+rawJsap.length+" characters")
        log.info("Parsing jsap...")
        const jsap:Jsap= JSON.parse(rawJsap)
        return jsap
    }

    private getConfiguredJsap(jsap:Jsap,defaults:any,config:any):Jsap{
        if(!config.forceHostParams){
            jsap.host=defaults.HOST_NAME;
            if(defaults.tls=="true"){
                jsap.sparql11protocol.protocol="https";
                jsap.sparql11protocol.port=defaults.HTTP_PORT;
                jsap.sparql11seprotocol.protocol="wss";
                jsap.sparql11seprotocol.availableProtocols.wss.port=defaults.WS_PORT;
            }else{
                jsap.sparql11protocol.protocol="http";
                jsap.sparql11protocol.port=defaults.HTTP_PORT;
                jsap.sparql11seprotocol.protocol="ws";
                jsap.sparql11seprotocol.availableProtocols.ws.port=defaults.WS_PORT;
            }
            return jsap
        }else{
            //leave jsap as it is
            return jsap
        }
    }

    public async test(_jsap:Jsap){

        const jsap= this.getConfiguredJsap( _jsap, this.sepaDefaults, this.config);
        
        let subNumberArray:any=[]
        if(this.config.hasOwnProperty("subNumberArray")){
            if(this.config.subNumberArray){
                const string:string= this.config.subNumberArray as string;
                subNumberArray= JSON.parse(string);
            }
        }


        log.info("** Jsap parsed, testing integrity...")
        const validator= new JsapSchemaValidator(jsap);
        
        //INTEGRITY TEST
        if(validator.checkJsapIntegrity()){
            log.info("| Host: "+jsap.host);
            log.info("| Protocol: "+jsap.sparql11protocol.protocol)
            log.info("| Http port: "+jsap.sparql11protocol.port)
            log.info("| Wss port: "+(jsap.sparql11seprotocol.protocol=="ws"?
                jsap.sparql11seprotocol.availableProtocols.ws.port:
                jsap.sparql11seprotocol.availableProtocols.wss.port)
            )
            log.info("| Queries: "+Object.keys(jsap.queries).length)
            log.info("| Updates: "+Object.keys(jsap.updates).length)
            log.info("Jsap is valid, proceeding with PAC test")
        }else{
            throw new Error("INVALID JSAP!")
        }
        
        //PAC TEST
        //const tester= new PacTester(jsap);
        const tester= new SubTester(jsap);
        const testResult= await tester.test();
    
        //log.info("TestResult:",testResult)
        return testResult
    }

}