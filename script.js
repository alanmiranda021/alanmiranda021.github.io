document.getElementById('year').textContent = new Date().getFullYear();
const menuBtn = document.querySelector('.menu-btn');
const menu = document.querySelector('.menu');
menuBtn.addEventListener('click', () => menu.classList.toggle('open'));
menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{ if(entry.isIntersecting) entry.target.classList.add('show'); });
},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
