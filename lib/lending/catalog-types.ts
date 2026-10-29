export interface CatalogCard {
 public_uid:string; name:string; card_number:string|null; category:string; grade:string;
 image_url:string|null; buy_price:number; buy_price_updated_at:string|null;
}
export type DeclaredGrade='PSA10'|'other'|'ungraded';
export interface ImageCardHints {name:string|null;cardNumber:string|null;category:'pokemon'|'onepiece'|null;setName:string|null;language:string|null;rarity:string|null}
export interface CatalogSearch {cards:CatalogCard[];total:number;page:number;hints?:ImageCardHints;imageRequestId?:string}
export interface CatalogAssessment {
 id:string; card:CatalogCard; indicative_jpy:number|null; reasons:string[]; expires_at:string;
 declared_grade:DeclaredGrade; cert_number:string|null; search_method:'catalog'|'image';
}
