'use strict';

export const VUSIC_PROFILE=Object.freeze({
  email:'coolinfatuation@gmail.com',
  primaryArtist:'Mohit Pandey',composer:'Mohit Pandey',lyricist:'Mohit Pandey',label:'Vusic Records',copyrightOwner:'Vusic Records',signatory:'Mohit Pandey',
  releasedPreviously:false,platforms:'all',explicitContent:false,releaseDateRule:'earliest-allowed',genre:'auto',language:'auto',finalSubmit:true,
  choices:{
    releasedPreviously:['No','Not released before','Previously unreleased','New release'],
    platforms:['Select all','All platforms','All stores','All','Select All Stores','Every platform'],
    explicitContent:['No','Not explicit','Clean','Non-explicit','None'],
    releaseDate:['Earliest available','Earliest allowed','As soon as possible','Today','Next available date'],
    agreement:['I agree','Sign the agreement','Agree','Accept','I accept','Confirm agreement'],
    finalSubmit:['Submit Release','Submit','Release Now','Confirm','Enter','Send for Review'],
    genre:{Pop:['Pop','Indie Pop','Alternative Pop'],Folk:['Folk','Indian Folk','World'],HipHop:['Hip-Hop','Hip Hop','Rap'],Electronic:['Electronic','Dance','EDM'],Rock:['Rock','Alternative Rock'],Devotional:['Devotional','Spiritual','World'],default:['Pop','Indie Pop','Alternative']},
    language:{Hindi:['Hindi','हिन्दी'],English:['English'],Hinglish:['Hindi','English'],Kumaoni:['Kumaoni','Hindi','Other'],default:['Hindi','English','Other']}
  }
});

export function normalizeVusicRelease(release={}){
  const r={...release};
  r.email=r.email||VUSIC_PROFILE.email;
  r.artist=r.artist||r.primaryArtist||VUSIC_PROFILE.primaryArtist;
  r.primaryArtist=r.primaryArtist||r.artist||VUSIC_PROFILE.primaryArtist;
  r.composer=r.composer||VUSIC_PROFILE.composer;
  r.lyricist=r.lyricist||VUSIC_PROFILE.lyricist;
  r.label=r.label||VUSIC_PROFILE.label;
  r.copyrightOwner=r.copyrightOwner||VUSIC_PROFILE.copyrightOwner;
  r.signatory=r.signatory||VUSIC_PROFILE.signatory;
  if(typeof r.releasedPreviously!=='boolean')r.releasedPreviously=VUSIC_PROFILE.releasedPreviously;
  if(typeof r.explicitContent!=='boolean')r.explicitContent=VUSIC_PROFILE.explicitContent;
  if(!r.platforms||!r.platforms.length)r.platforms=VUSIC_PROFILE.platforms;
  if(typeof r.confirmSubmit!=='boolean')r.confirmSubmit=VUSIC_PROFILE.finalSubmit;
  r.choiceFallbacks={...VUSIC_PROFILE.choices,...(r.choiceFallbacks||{})};
  return r;
}
