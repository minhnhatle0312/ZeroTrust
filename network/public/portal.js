const search=document.getElementById('function-search');
const tabs=[...document.querySelectorAll('.category-tabs button')];
const cards=[...document.querySelectorAll('.function-card')];
let category='all';
const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();
function filter(){
  let visible=0;
  for(const card of cards){const show=(category==='all'||card.dataset.category===category)&&normalize(card.textContent+' '+card.dataset.search).includes(normalize(search.value));card.hidden=!show;if(show)visible++;}
  document.getElementById('empty-functions').hidden=visible>0;
}
search.addEventListener('input',filter);
for(const tab of tabs)tab.addEventListener('click',()=>{category=tab.dataset.category;for(const button of tabs){button.classList.toggle('selected',button===tab);button.setAttribute('aria-pressed',String(button===tab));}filter();});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();search.focus();search.scrollIntoView({block:'center',behavior:'smooth'});}});
