// The encounter is told through her sculpture and the clearing itself.
// Only the physical white-spore visibility effect belongs on the HUD layer.
export function updateMotherAtmosphere(game,mist,visible){
  mist.classList.toggle('hidden',!(visible&&game.player.sporeSlow&&game.status==='playing'));
}
