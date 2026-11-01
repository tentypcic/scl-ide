// Small UI behaviours shared by the surrounding workspace controls.
const menus=[...document.querySelectorAll('.tool-menu')];
document.addEventListener('click',event=>{
  for(const menu of menus){
    if(!menu.contains(event.target)||event.target.closest('.tool-popover button'))menu.open=false;
  }
});
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  for(const menu of menus)if(menu.open){menu.open=false;menu.querySelector('summary').focus();}
});
// Keep dialog-local navigation separate from the simulator's global shortcuts.
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('keydown',event=>event.stopPropagation());
