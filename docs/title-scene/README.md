# Live title scene review

These images are offline renders of the actual Three.js scene meshes and supplied texture maps, without the DOM logo and menu controls. They are composition reviews, not browser screenshots. Lighting and fog are approximations; cloud fog suppression is a runtime material setting.

The composition was iterated to reduce the main arch, keep menu space in portrait, retain far-cliff relief, and place a narrow river below the canyon rim. The title uses one renderer shared with gameplay, separate scenery/material caches, the existing player rig, four supplied cloud instances and supplied canyon formations.

Validation: all gameplay checks and all four automated playthroughs passed; title/flag tests cover responsive framing, skeletal idle, reduced motion, chapter transitions, hoist timing, paused animation, one celebration burst, streaming and new/legacy checkpoint saves. App integration covers slow loading, concurrent Play requests, menu access, editor entry and return. Every forest breakable seal is a visible spore balloon with its top and width aligned to collision. Forest bird construction was removed.

Live WebGL rendering, touch feel and phone performance remain unverified.
