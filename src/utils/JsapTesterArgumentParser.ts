import ArgumentsParser from "../lib/ArgumentsParser";

export interface JsapTesterConfiguration{
    jsapPath: string;
    isApiActive: boolean;
    forceHostParams: boolean;
    subNumberArray: string;
    updateNumberArray: string;
}

export default class JsapTesterArgumentParser extends ArgumentsParser{
    constructor(){
        super({
            jsapPath: {
                argName: "-jsap"
            },
            apiMode:{
                argName: "-api",
                isFlag: true
            },
            forceHostParams:{
                argName: "-forceHost",
                isFlag: true
            },
            subNumberArray:{
                argName: "-s"
            },
            updateNumberArray:{
                argName: "-u"
            }
        });
    }
}