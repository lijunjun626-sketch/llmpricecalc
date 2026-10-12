const $=id=>document.getElementById(id);
const rates={low:{input:.10,output:.50,read:.01,write:.125,label:'≤100K prompt'},high:{input:.50,output:2.50,read:.05,write:.625,label:'>100K prompt'},old:{input:1,output:5,read:.10,write:1.25}};
const numericIds=['inputTokens','outputTokens','cacheRead','cacheWrite','requests'];
const value=id=>Math.max(0,Number($(id).value)||0);
const usd=(n,d=2)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
function baseCost(rate,x){return(x.input*rate.input+x.output*rate.output+x.read*rate.read+x.write*rate.write)/1e6}
function calculate(){
 const x={input:value('inputTokens'),output:value('outputTokens'),read:value('cacheRead'),write:value('cacheWrite')},requests=Math.max(1,value('requests'));
 const prompt=x.input+x.read+x.write,choice=document.querySelector('input[name=tier]:checked').value;
 const tier=choice==='auto'?(prompt<=100000?'low':'high'):choice,mult=($('batch').checked?.5:1)*($('usOnly').checked?1.1:1);
 const low=baseCost(rates.low,x)*mult,high=baseCost(rates.high,x)*mult,current=tier==='low'?low:high,old=baseCost(rates.old,x)*mult;
 const monthly=current*requests,oldMonthly=old*requests,saved=Math.max(0,oldMonthly-monthly),pct=oldMonthly?Math.max(0,(saved/oldMonthly)*100):0;
 $('appliedTier').textContent=rates[tier].label+(choice==='auto'?' · automatic':' · manual');
 $('monthlyCost').textContent=usd(monthly,monthly<1?4:2);$('perRequest').textContent=`${usd(current,6)} per request`;
 $('oldMonthly').textContent=usd(oldMonthly,oldMonthly<1?4:2);$('savings').textContent=usd(saved,saved<1?4:2);$('savingsPercent').textContent=`${pct.toFixed(1)}% less`;
 $('meterFill').style.width=`${Math.min(100,pct)}%`;$('lowScenario').textContent=usd(low,6);$('highScenario').textContent=usd(high,6);
 $('thresholdNote').textContent=`${prompt.toLocaleString()} prompt tokens. ${prompt<=100000?'This request is in the lower price tier.':'This request crosses the 100K threshold.'}`;
}
document.getElementById('cost-form').addEventListener('input',calculate);
calculate();
