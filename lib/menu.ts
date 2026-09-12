export type Category = 'Starters' | 'Main Dishes' | 'Specials';
export const menu: { id:string; name:string; category:Category; note?:string; variants?:string[] }[] = [
 {id:'s1',name:'Silken tofu chili',category:'Starters'},
 {id:'s2',name:'Crispy eggplant fries',category:'Starters'},
 {id:'s3',name:'Spicy cucumber',category:'Starters'},
 {id:'s4',name:'"Lollipop" chicken',category:'Starters'},
 {id:'s5',name:'Century egg, smoky paprika, dough',category:'Starters'},
 {id:'s6',name:'Wood ear mushroom',category:'Starters'},
 {id:'s7',name:'Spicy Braised Beef Slices',category:'Starters'},
 {id:'m1',name:'Lá Bù Lá beef (Our signature dish)',category:'Main Dishes',variants:['Standard','Beef MAX']},
 {id:'m2',name:'Xiao Mian',category:'Main Dishes',note:'The website calls one tofu option vegan but mentions chicken broth. Please confirm the actual ingredients for each variant.',variants:['Standard','Tofu with chicken broth — confirm','Marinated tofu version']},
 {id:'m3',name:'Sweet-potato noodles bowl',category:'Main Dishes',variants:['Standard','Braised tofu version']},
 {id:'m4',name:"Stir-fry Pork with Siehuan 'Paoeai'",category:'Main Dishes'},
 {id:'m5',name:'Taste of Hometown',category:'Main Dishes'},
 {id:'m6',name:'Kids Menu',category:'Main Dishes',note:'Daily recipe. Also listed as Children’s menu under Specials. Confirm whether these are the same dish; leave an unused listing inactive.'},
 {id:'p1',name:'Braised Chicken Feet/Pork Feet',category:'Specials',variants:['Chicken feet','Pork feet']},
 {id:'p2',name:'Beef skewers',category:'Specials'},
 {id:'p3',name:'Lá Bù Lá Mapo Tofu',category:'Specials'},
 {id:'p4',name:'Today Green Market-until sold-out',category:'Specials',note:'The website repeats the Mapo Tofu description here. List the ingredients of the dish currently served.'},
 {id:'p5',name:'Secret Hidden Menu-until sold-out',category:'Specials',note:'Changing chalkboard dish. List the ingredients of the dish currently served.'},
 {id:'p6',name:"Children's menu",category:'Specials',note:'Possible duplicate of Kids Menu in Main Dishes. Keep only the listing you actually sell active if both refer to the same recipe.'},
];
export const categories:Category[]=['Starters','Main Dishes','Specials'];
