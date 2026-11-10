import type {AlertButton} from 'react-native';
export const Alert={alert(title:string,message?:string,buttons?:AlertButton[]){
 const action=buttons?.find(button=>button.style!=='cancel');
 if(action){if(window.confirm([title,message].filter(Boolean).join('\n\n')))action.onPress?.();}
 else window.alert([title,message].filter(Boolean).join('\n\n'));
}};
