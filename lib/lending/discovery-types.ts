// Provider-neutral card discovery. No upstream URLs, prices or credentials.
export interface DiscoveryCard {
 id:string;name:string;cardNumber:string;category:string;imageUrl:string|null;
 kind:'catalog'|'external';cardUid:string|null;productId:string|null;
}
export interface DiscoverySearch {cards:DiscoveryCard[];page:number;hasMore:boolean;partial:boolean;message?:string}
