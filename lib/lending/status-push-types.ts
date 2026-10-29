export interface StatusNotification {id:string;entity_kind:'case'|'loan';entity_id:string;entity_version:number;from_status:string|null;to_status:string;created_at:string}
export interface StatusPushJob {id:string;notificationId:string;leaseId:string;token:string;kind:'case'|'loan';entityId:string}
export interface StatusPushReport {configured:boolean;events:(StatusNotification&{deliveries:{id:string;status:string;total_attempts:number;error_code:string|null;accepted_at:string|null;received_at:string|null}[]})[]}
