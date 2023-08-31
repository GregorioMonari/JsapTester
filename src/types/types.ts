export interface ForcedBindingsTemplate{
	[key: string]: {
		type: string;
		value: string;
	};
};

export interface Jsap{
  host: string;
  oauth?: any;
  sparql11protocol: {
		protocol: string;
		port: number;
		query: {
			path: string;
			method: string;
			format: string;
		},
		update: {
			path: string;
			method: string;
			format: string;
		}
	};
  sparql11seprotocol: {
		protocol: string;
		availableProtocols: {
			ws: {
				port: number;
				path: string;
			},
			wss: {
				port: number;
				path: string;
			}
		}
  };
  namespaces: {
	[key: string]: string
  };
  extended?: any;
  updates: {
	[key: string]: {
		sparql: string;
		forcedBindings: ForcedBindingsTemplate
	};
  };
  queries: {
	[key: string]: {
		sparql: string;
		forcedBindings: ForcedBindingsTemplate
	};
  }
}


export interface UpdateResponse{
	status: number;
	statusText: string;
}