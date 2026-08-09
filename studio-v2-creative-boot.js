'use strict';
import {TEMPLATES,VISUALS} from './studio-v2-visuals.js';
import {EXTRA_TEMPLATES,EXTRA_VISUALS} from './studio-v2-creative.js';
const existing=new Set(TEMPLATES.map(x=>x.id));
for(const t of EXTRA_TEMPLATES)if(!existing.has(t.id))TEMPLATES.push(t);
Object.assign(VISUALS,EXTRA_VISUALS);
