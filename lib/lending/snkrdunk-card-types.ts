export interface SnkrdunkCard {
 productId:string;name:string;cardNumber:string;category:'pokemon'|'onepiece';imageUrl:string|null;sourceUrl:string;
}
export interface SnkrdunkCardSearch {cards:SnkrdunkCard[];page:number;hasMore:boolean}
