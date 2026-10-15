#!/usr/bin/env node

// Script de prévisualisation directe dans le terminal pour Vyta
const bordeaux = (txt) => `\x1b[38;2;163;31;68m${txt}\x1b[0m`;
const bordeauxDeep = (txt) => `\x1b[38;2;77;11;32m${txt}\x1b[0m`;
const rose = (txt) => `\x1b[38;2;239;160;180m${txt}\x1b[0m`;
const green = (txt) => `\x1b[38;2;48;209;88m${txt}\x1b[0m`;
const yellow = (txt) => `\x1b[38;2;255;214;10m${txt}\x1b[0m`;
const cyan = (txt) => `\x1b[38;2;100;210;255m${txt}\x1b[0m`;
const bold = (txt) => `\x1b[1m${txt}\x1b[0m`;
const dim = (txt) => `\x1b[2m${txt}\x1b[0m`;

console.clear();
console.log('');
console.log(bordeaux(`  ╭──────────────────────────────────────────────────────────╮`));
console.log(bordeaux(`  │ `) + bold(`✦ VYTA ONE (R21) · SMART RING COMPANION APP`) + bordeaux(`             │`));
console.log(bordeaux(`  │ `) + dim(`  Châssis Titane · Finition Bordeaux Impérial (#4D0B20)`) + bordeaux(`   │`));
console.log(bordeaux(`  ╰──────────────────────────────────────────────────────────╯`));
console.log('');

// Statut Bague & Connectivité
console.log(`  ${bold('ANNEAU INTELLIGENT :')}  ${green('● Connecté Bluetooth')}  ${dim('│')}  ${green('87%')} Batterie  ${dim('│')}  ${bordeaux('CoVyta IA : Actif')}`);
console.log('');

// Tableau de bord Santé
console.log(`  ${bordeauxDeep('┌─')} ${bold('SCORE DE VITALITÉ')} ${bordeauxDeep('─────────────────────────────────────────────┐')}`);
console.log(`  ${bordeauxDeep('│')}                                                            ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}     ${bold(rose('91'))} / 100   ${green('● Optimal')}                                   ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}     Sommeil: ${bold('89%')}  ${dim('│')}  Récup. VRC: ${bold('95%')}  ${dim('│')}  Activité: ${bold('88%')}     ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}                                                            ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('└────────────────────────────────────────────────────────────┘')}`);
console.log('');

// Section Course & Télémétrie avec Courbe ASCII
console.log(`  ${bordeauxDeep('┌─')} ${bold('COURSE & CARDIO · TÉLÉMÉTRIE LIVE')} ${bordeauxDeep('─────────────────────────────┐')}`);
console.log(`  ${bordeauxDeep('│')}                                                            ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   Distance : ${bold(rose('3.85 km'))}   Allure : ${bold('5:08 /km')}   Temps : ${bold('19:44')}        ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   Vitesse  : ${bold(green('11.7 km/h'))}  Cardio : ${bold(rose('138 bpm'))}   Dénivelé : ${dim('+30 m')}     ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}                                                            ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   ${bold('COURBE 1 : DISTANCE PARCOURUE (km)')}                            ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   ${dim('km')}                                                        ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   5.0 ┼                                    ${bordeaux('╭──•')} ${rose('3.85k')}    ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   3.3 ┼                             ${bordeaux('╭──────╯')}             ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   1.7 ┼                  ${bordeaux('╭──────────╯')}                    ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   0.0 •${bordeaux('─────────────────╯')}                                   ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}       ${dim('00:00       05:00       10:00       15:00       20:00')}    ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}       ${dim('Axe horizontal : Temps de course')}                          ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}                                                            ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   ${bold('COURBE 3 : FRÉQUENCE CARDIAQUE (BPM)')}                          ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   ${dim('bpm')}                                                       ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   180 ┼                                           ${bordeaux('╭─•')} 178 ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   150 ┼                     ${bordeaux('╭─╮     ╭─────────────╯')}        ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}   120 ┼       ${bordeaux('╭─────────────╯   ╰─────╯')}                      ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}    60 •${bordeaux('──────╯')}                                                  ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}       ${dim('00:00       10:00       20:00       30:00       41:52')}    ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('│')}                                                            ${bordeauxDeep('│')}`);
console.log(`  ${bordeauxDeep('└────────────────────────────────────────────────────────────┘')}`);
console.log('');
console.log(`  ${dim('🌐 Serveur Web actif sur')} ${bold(cyan('http://localhost:5173/'))}`);
console.log(`  ${dim('Pour ouvrir l\'application en mode fenêtre mobile :')}`);
console.log(`  ${yellow('Start-Process msedge -ArgumentList "--app=http://localhost:5173", "--window-size=430,932"')}`);
console.log('');
