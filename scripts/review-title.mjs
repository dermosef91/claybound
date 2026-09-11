import {TitleScene} from '../dist/title-scene.js';
import {loadTitleWorld} from '../tests/load-title.mjs';
import {exportReview} from './review-scene.mjs';
const dir=process.argv[2];if(!dir)throw new Error('Provide output directory');
const {world,images}=await loadTitleWorld(),title=new TitleScene(world);
title.show();title.resize(Number(process.env.REVIEW_WIDTH||1280),Number(process.env.REVIEW_HEIGHT||720));
for(let i=0;i<60;i++)title.update(1/60);
await exportReview(title.view.scene,title.backRoot,dir,{camera:{x:0,y:3,z:26,elevation:5,viewW:title.viewW,viewH:title.viewH},theme:{...title.view.theme,ambient:1.65,sunPower:3.4},sky:'#81aed1',fog:'#81aed1',fogNear:35,fogFar:155,backgroundBlur:0},images);
