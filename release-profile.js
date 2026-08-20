'use strict';

export const RIDGE_RELEASE_PROFILE=Object.freeze({
  version:1,
  youtubeClientId:'1061806252746-tg3g74uovrt9e72osbloiq0poe9lllgh.apps.googleusercontent.com',
  ridgeCloudUrl:'https://ridge-cloud-media.founder-f53.workers.dev',
  vusic:{email:'coolinfatuation@gmail.com'},
  artist:{primary:'Mohit Pandey',composer:'Mohit Pandey',lyricist:'Mohit Pandey',label:'Vusic Records',copyrightOwner:'Vusic Records',signatory:'Mohit Pandey'},
  defaults:{releasedPreviously:false,platforms:'all',explicitContent:false,releaseDateRule:'earliest-allowed',genre:'auto',language:'auto',finalSubmit:true},
  fallbacks:{
    releasedPreviously:{preferred:['No'],alternates:['Not released before','Previously unreleased','New release']},
    platforms:{preferred:['Select all','All platforms','All stores'],alternates:['All','Select All Stores','Every platform']},
    explicitContent:{preferred:['No','Not explicit','Clean'],alternates:['Non-explicit','None']},
    releaseDate:{preferred:['Earliest available','Earliest allowed','As soon as possible'],alternates:['Today','Next available date']},
    artistRole:{primary:['Primary Artist','Main Artist','Artist'],composer:['Composer','Music Composer'],lyricist:['Lyricist','Lyrics Writer','Writer']},
    agreement:{preferred:['I agree','Sign the agreement','Agree'],alternates:['Accept','I accept','Confirm agreement']},
    finalSubmit:{preferred:['Submit Release','Submit','Release Now'],alternates:['Confirm','Enter','Send for Review']},
    genre:{Pop:['Pop','Indie Pop','Alternative Pop'],Folk:['Folk','Indian Folk','World'],HipHop:['Hip-Hop','Hip Hop','Rap'],Electronic:['Electronic','Dance','EDM'],Rock:['Rock','Alternative Rock'],Devotional:['Devotional','Spiritual','World'],default:['Pop','Indie Pop','Alternative']},
    language:{Hindi:['Hindi','हिन्दी'],English:['English'],Hinglish:['Hindi','English'],Kumaoni:['Kumaoni','Hindi','Other'],default:['Hindi','English','Other']}
  }
});

const text=s=>String(s||'').toLowerCase();
export function detectLanguage(lyrics=''){const s=String(lyrics||'');if(/[\u0900-\u097f]/.test(s))return 'Hindi';if(/\b(mai|main|mera|meri|tere|tera|pyaar|ishq|dil|raat|yaar)\b/i.test(s))return 'Hinglish';return 'English'}
export function detectGenre({title='',lyrics='',mood=''}={}){const s=text(`${title} ${lyrics} ${mood}`);if(/bhajan|devotional|prayer|shiv|ram|krishna|mahadev|भजन|भक्ति/.test(s))return 'Devotional';if(/phonk|drift|808|trap|rap|hip.?hop/.test(s))return 'HipHop';if(/folk|pahad|mountain|kumaon|uttarakhand|पहाड़|कुमाऊ/.test(s))return 'Folk';if(/edm|dance|club|festival|electronic|synth/.test(s))return 'Electronic';if(/rock|guitar|band|metal/.test(s))return 'Rock';return 'Pop'}
export function earliestAllowedDate(days=1){const d=new Date(Date.now()+Math.max(1,Number(days)||1)*86400000);return d.toISOString().slice(0,10)}
