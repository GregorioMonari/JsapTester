import { Jsap } from '../../types/types'
const log=require("greglogs").default
export default class JsapSchemaValidator{
    private jsap:Jsap;
    constructor(_jsap:Jsap){
        this.jsap=_jsap
    }

    checkJsapIntegrity():boolean{
        let isJsapValid=true
        if(!this.jsap.hasOwnProperty("host")){isJsapValid=false}
        if(!this.jsap.hasOwnProperty("queries")){isJsapValid=false}
        if(!this.jsap.hasOwnProperty("updates")){isJsapValid=false}else{
            if(Object.keys(this.jsap.updates).length==0){
                isJsapValid=false
            }
        }
        return isJsapValid
    }
    
}