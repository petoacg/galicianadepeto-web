export interface Hit { title:string; path:string; position:number; imageId?:string|null; parentTitle?:string|null; snippets:string[]; savedQuery?:string; note?:string }
export interface SearchPreset {query:string;title?:string;author?:string;place?:string;yearFrom?:string;yearTo?:string;section?:string;advanced?:boolean;fullText?:boolean;id?:string;createdAt?:number}
export type Route = {screen:string; [key:string]:unknown};
