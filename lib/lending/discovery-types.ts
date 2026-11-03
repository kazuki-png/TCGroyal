// Provider-neutral card discovery. No upstream URLs, prices or credentials.
export interface DiscoveryCard {
 id:string;name:string;cardNumber:string;category:string;imageUrl:string|null;
 kind:'catalog'|'external';cardUid:string|null;productId:string|null;
 imageMatch?:{matchedOn:('number'|'set'|'name'|'rarity'|'specific'|'oldBack')[]};
}
export interface DiscoverySearch {cards:DiscoveryCard[];page:number;hasMore:boolean;partial:boolean;message?:string}
export interface ImageDiscoverySearch extends DiscoverySearch {
 hints:{name:string|null;cardNumber:string|null;category:'pokemon'|'onepiece'|null;setName:string|null;language:string|null;rarity:string|null;specificTerms?:string[];oldBack?:boolean|null};
 searchQuery:string;
 visualSort?:'applied'|'unavailable'|'not_needed';
}
