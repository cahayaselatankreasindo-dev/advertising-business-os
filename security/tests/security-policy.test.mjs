import test from "node:test";
import assert from "node:assert/strict";

const OWNER="cahayaselatankreasindo@gmail.com";
const TEAM="zefdas@gmail.com";
const teamSheets=["Leads","Clients","Projects"];
const ownerCollections=["leads","clients","projects","finance","memory","marketingSpend","materials","costSheets","services","purchaseOrders","quotationSnapshots"];
function role(email){email=String(email||"").trim().toLowerCase();return email===OWNER?"owner":email===TEAM?"team":null;}
function verify(c,aud,now=1900000000){
 if(!c||c.aud!==aud)return "WRONG_AUDIENCE";
 if(!["accounts.google.com","https://accounts.google.com"].includes(c.iss))return "WRONG_ISSUER";
 if(Number(c.exp||0)<=now+60)return "EXPIRED";
 if(String(c.email_verified).toLowerCase()!=="true")return "EMAIL_UNVERIFIED";
 return role(c.email)?"OK":"EMAIL_NOT_ALLOWED";
}
function authorize(r,p){
 const a=String(p.action||"").toLowerCase();
 if(a==="send_cold_email")return "COLD_EMAIL_APPROVAL_REQUIRED";
 if(a==="request_cold_email")return "OK";
 if(["approve_cold_email","reject_cold_email","send_approved_cold_email"].includes(a))return r==="owner"?"OK":"OWNER_ONLY";
 if(a==="sync_all")return Object.keys(p).some(k=>ownerCollections.includes(k)&&r==="team"&&!["leads","clients","projects"].includes(k))?"FORBIDDEN_COLLECTION":"OK";
 if(["insert","delete","update_status"].includes(a)){
  const sheet=String(p.sheet||(a==="insert"?"":"Leads"));
  return (r==="owner"?ownerCollections.map(k=>({leads:"Leads",clients:"Clients",projects:"Projects",finance:"Finance",memory:"Memory",marketingSpend:"Marketing_Spend",materials:"Materials",costSheets:"Cost_Sheets",services:"Services",purchaseOrders:"Purchase_Orders",quotationSnapshots:"Quotations"}[k])):teamSheets).includes(sheet)?"OK":"FORBIDDEN_SHEET";
 }
 return "ACTION_NOT_ALLOWED";
}
function filter(d,r){return r==="owner"?d:{leads:d.leads||[],clients:d.clients||[],projects:d.projects||[],lastSynced:d.lastSynced||null};}
function transition(s,a,r){
 if(r!=="owner"&&(a==="approve"||a==="reject"||a==="send"))throw Error("OWNER_ONLY");
 if(a==="approve"||a==="reject"){if(s!=="PENDING")throw Error("INVALID_APPROVAL_STATE");return a==="approve"?"APPROVED":"REJECTED";}
 if(a==="send"){if(s!=="APPROVED")throw Error("EMAIL_NOT_APPROVED");return "SENDING";}
 throw Error("UNKNOWN_TRANSITION");
}
const claims=(x={})=>({aud:"csk-web-client",iss:"https://accounts.google.com",exp:1900003600,email:OWNER,email_verified:"true",...x});

test("Owner email maps to Owner",()=>assert.equal(role(OWNER.toUpperCase()),"owner"));
test("Team email maps to Team",()=>assert.equal(role(TEAM),"team"));
test("Unlisted account denied",()=>assert.equal(role("attacker@gmail.com"),null));
test("valid Owner claims pass",()=>assert.equal(verify(claims(),"csk-web-client"),"OK"));
test("valid Team claims pass",()=>assert.equal(verify(claims({email:TEAM}),"csk-web-client"),"OK"));
test("wrong OAuth audience denied",()=>assert.equal(verify(claims(),"wrong"),"WRONG_AUDIENCE"));
test("wrong issuer denied",()=>assert.equal(verify(claims({iss:"evil"}),"csk-web-client"),"WRONG_ISSUER"));
test("expired token denied",()=>assert.equal(verify(claims({exp:1900000060}),"csk-web-client"),"EXPIRED"));
test("unverified email denied",()=>assert.equal(verify(claims({email_verified:"false"}),"csk-web-client"),"EMAIL_UNVERIFIED"));
test("unknown verified Google user denied",()=>assert.equal(verify(claims({email:"intruder@gmail.com"}),"csk-web-client"),"EMAIL_NOT_ALLOWED"));
test("Team data contains only CRM and Projects",()=>assert.deepEqual(Object.keys(filter({leads:[],clients:[],projects:[],finance:[1],memory:[1],marketingSpend:[1]},"team")).sort(),["clients","lastSynced","leads","projects"]));
test("Owner data remains unfiltered",()=>assert.deepEqual(filter({finance:[1],leads:[2]},"owner"),{finance:[1],leads:[2]}));
test("Team sync CRM only allowed",()=>assert.equal(authorize("team",{action:"sync_all",leads:[],clients:[],projects:[]}),"OK"));
test("Team Finance sync denied",()=>assert.equal(authorize("team",{action:"sync_all",leads:[],finance:[]}),"FORBIDDEN_COLLECTION"));
test("Team cannot insert Finance",()=>assert.equal(authorize("team",{action:"insert",sheet:"Finance"}),"FORBIDDEN_SHEET"));
test("Team can update Project status",()=>assert.equal(authorize("team",{action:"update_status",sheet:"Projects"}),"OK"));
test("Owner can insert Finance",()=>assert.equal(authorize("owner",{action:"insert",sheet:"Finance"}),"OK"));
test("Team cannot approve email",()=>assert.equal(authorize("team",{action:"approve_cold_email"}),"OWNER_ONLY"));
test("Direct send is rejected",()=>assert.equal(authorize("owner",{action:"send_cold_email"}),"COLD_EMAIL_APPROVAL_REQUIRED"));
test("Request email enters approval workflow",()=>assert.equal(authorize("team",{action:"request_cold_email"}),"OK"));
test("Only Owner can approve",()=>{assert.throws(()=>transition("PENDING","approve","team"),/OWNER_ONLY/);assert.equal(transition("PENDING","approve","owner"),"APPROVED");});
test("Email cannot send before approval",()=>assert.throws(()=>transition("PENDING","send","owner"),/EMAIL_NOT_APPROVED/));
test("Approved request can be claimed once",()=>{const s=transition("APPROVED","send","owner");assert.equal(s,"SENDING");assert.throws(()=>transition(s,"send","owner"),/EMAIL_NOT_APPROVED/);});
test("Rejected request cannot be approved or sent",()=>{const s=transition("PENDING","reject","owner");assert.equal(s,"REJECTED");assert.throws(()=>transition(s,"approve","owner"),/INVALID_APPROVAL_STATE/);});
