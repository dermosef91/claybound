# The clay workshop

Open **Level editor** on the title screen, or **Edit this chapter** from pause. All four existing chapters can be edited in their actual Three.js environment.

## Design controls

- Tap an object, then drag it. Round handles resize platforms horizontally.
- Drag empty space or use Pan to move the camera. Pinch with two fingers, scroll a mouse wheel, or use the zoom buttons.
- Drag the chapter overview or select a passage to travel through a level. Browse objects provides a non-canvas selection path, including the player start.
- Properties expose coordinates, platform width, moving-platform travel, timing, switches, counterweights, wind forces, enemy patrols and presses.
- Add places an object at the center of the view. Duplicate, Delete, Undo and Redo support iteration. The player start, starting platform and sole finish are protected against deletion.
- Snap, Move contents and Jump guide are in More. Moving contents carries nearby beads, flowers, enemies, switches, springs and the spawn with their supporting platform.
- Matching circuit names connect the existing simulation systems. Existing authored cable routes remain intact; newly connected devices gain cables. Moving or resizing the finish updates the bell and completion boundary.

The top **Test** button starts at the chapter spawn. A selected platform offers **Test from this platform**. Both run the real platforming simulation, then **Back to editor** restores the unchanged draft, selection, undo history and camera. Test checkpoints and results do not update campaign progress or records. The jump guides also sample the real simulation with full running speed and jump held; they show the initial mechanism state, not a guarantee through every moving phase.

## Saving and sharing a design

Changes save automatically to this browser/device. Regular Play initially uses the saved edited chapter. In **Chapters**, use **Play updated original** to play the latest shipped design without deleting the draft, or **Play your edit** to return to it. The chapter card shows **Original** or **Your edit**, and this choice is remembered after refreshing the page. Returning from the editor selects your saved edit again. Custom best scores and checkpoints are isolated from original chapter records. Each design has a content-derived layout version so stale checkpoints cannot resume into revised geometry.

**More → Export level backup** downloads a JSON file. **Import level backup** loads it into its matching chapter, with Undo available for the replacement. Files are checked for schema, numeric bounds, unique IDs, object limits, matching chapter and base layout. Original environment assets and executable game code cannot be replaced by imported data.

Older drafts retain their own enemy placements, including the canyon’s pre-Drifter roster. To see the four current Dust Drifters, select the updated original canyon; this does not rewrite customized enemies or platforms.

**Restore original chapter** requires an in-editor confirmation and removes that chapter's saved customization. Export first to keep it. If browser storage is unavailable or full, the editor retains changes for the session and displays an explicit request to export; it does not claim that they were saved.

### Permanent changes for everyone

The hosting can support this, but this version remains a static game with device-local drafts and no editor password. Shared publishing would add a small server component and persistent D1 storage for validated chapter revisions. Public play would load the latest published revision, with the bundled chapters as the initial defaults. A password-checked server session would protect editor writes and publishing; a password hidden in JavaScript would not provide access control.

The recommended flow is **Edit → Test → Publish changes**. Drafts remain separate until publishing, and prior revisions support rollback. Publishing changes a chapter's layout version so existing checkpoints cannot place players inside moved platforms. The public game can stay open while the editor and all write endpoints require the editor session. No shared storage, password or global publishing action has been enabled in this update.

## Keyboard

| Control | Action |
| --- | --- |
| Arrow keys | Nudge selection; pan when nothing is selected |
| Shift + arrows | Nudge one unit |
| Space + drag | Pan |
| Ctrl / Cmd + Z | Undo |
| Ctrl / Cmd + Shift + Z, Ctrl + Y | Redo |
| Ctrl / Cmd + D | Duplicate |
| Delete / Backspace | Delete selection |
| Escape | Close a workshop panel or clear selection |

## Architecture and verification

- `editor-model.js`: validated data, draft persistence, transformations, connection repair and bounded undo history.
- `editor.js`: touch/pointer/keyboard tools, inspector, overview, overlays and simulation-sampled jump guides.
- `editor.css`: responsive desktop inspector and mobile bottom sheet, 44px touch targets and safe-area handling.
- `levels.js` / `simulation.js`: optional level definitions are cloned into fresh runtime instances; original authored levels remain unchanged.
- `world.js`: editor camera and streamed foreground refresh preserve loaded model resources and the background.

`npm run check` covers the original platforming gate plus completion records, draft round trips, import rejection, protected anchors, connected mechanisms, save failure, real simulation loading, camera projection and model-resource retention. DOM integration uses LinkeDOM with the actual app/editor/simulation modules; canvas rendering, audio and frame scheduling are replaced. It exercises pointer drag/resize, mobile pinch/pan, properties, palette actions, history, modal focus, testing/return, saved custom play and completion navigation.

No browser was opened for this task. GPU appearance, responsive visual composition, native downloads and real mobile touch feel still need live-device verification. DOM/event and CPU scene tests are not browser or screenshot QA.
