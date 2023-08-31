const log=require("greglogs").default
log.setLogLevel(2);
import * as fs from 'fs'
import { Jsap } from './types/types'

import JsapTesterArgumentParser from './utils/JsapTesterArgumentParser'
import Server from './server/Server'
import JsapTester from './JsapTools/JsapTester'

//TITLE
console.clear()
console.log("#######################################################")
console.log("### ================== JSAP TESTER ================ ###")
console.log("#######################################################")
console.log("### A Semantic client which tests each query-update ###")
console.log("### pair specified in a Jsap file                   ###")
console.log("### @Author: Gregorio Monari                        ###")
console.log("### @Date: 21/8/2023                                ###")
console.log("#######################################################")
console.log(" ")






main()

async function main():Promise<void>{

    //Get command line arguments
    const argsParser= new JsapTesterArgumentParser()
    const appConfig=argsParser.parseArguments()

    let empty=0;
    Object.keys(appConfig).forEach(k=>{
        if(!appConfig[k]) empty++
    })
    if(empty==Object.keys(appConfig).length){
        printHelp()
        return
    }

    //Start config
    log.debug("Command line arguments:",appConfig)

    //Get default sepa parameters from environment variables
    const sepaDefaults=getSepaDefaultParams()
    log.debug("Default sepa host parameters:",sepaDefaults)

    //Launch application in eather API or LOCAL mode
    if(appConfig.apiMode){
        log.info("Launching application in Api Mode...")
        const server= new Server(3000);
        server.listen();
    }else{
        if(!appConfig.jsapPath){
            throw new Error("The path of the jsap file must be provided when running locally")
        }
        log.info("Launching application locally...")
        const tester= new JsapTester(appConfig,sepaDefaults);
        const jsap= tester.importJsapFromFile()
        const testResult= await tester.test(jsap);
        log.info("TestResult:",testResult)    
    }
}

function getSepaDefaultParams(){
    let envDict={
        "HOST_NAME":process.env.HOST_NAME||"localhost",
        "HTTP_PORT":process.env.HTTP_PORT||"8000",
        "WS_PORT":process.env.WS_PORT||"9000",
        "TLS":process.env.TLS||"false",
    }
    return envDict
}

function printHelp(){
    //DISPLAY HELP
    console.log("Usage:")
    console.log("* npm start -jsap <path>: tests the specified jsap file")
    console.log("* npm start -jsap <path> -f: force the test to use the provided jsap host params")
    console.log("* npm start -api: starts a REST api which can perform the previous tasks remotely")
}