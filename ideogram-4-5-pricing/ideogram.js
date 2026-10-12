const rates={generate:{low:.03,medium:.06,high:.10},source:{very_low:.008,low:.03,medium:.06,high:.22},precise:{very_low:.008,low:.03,medium:.06,high:.22}};
const operation=document.querySelector('#operation'),quality=document.querySelector('#quality'),resolution=document.querySelector('#resolution'),count=document.querySelector('#count');
function update(){
  const available=rates[operation.value];
  for(const option of quality.options) option.disabled=available[option.value]===undefined;
  if(available[quality.value]===undefined) quality.value='low';
  const units=Math.max(1,Number.parseInt(count.value,10)||1),rate=available[quality.value];
  document.querySelector('#totalCost').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(units*rate);
  document.querySelector('#unitCost').textContent=`$${rate.toFixed(3)}`;
  document.querySelector('#summary').textContent=`${units.toLocaleString()} ${quality.options[quality.selectedIndex].text} ${operation.options[operation.selectedIndex].text} image${units===1?'':'s'} at ${resolution.value}`;
}
[operation,quality,resolution,count].forEach(el=>el.addEventListener('input',update));update();
