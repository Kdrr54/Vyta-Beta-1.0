import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { WEEK, TODAY_INDEX, weekMetrics } from '../data/health';
import { 
  dailyInsights, 
  quickQuestionsByDay, 
  seedChatsByDay, 
  ChatMessage, 
  QuickQuestion 
} from '../data/covyta';
import { WeekSelector } from './WeekSelector';
import { 
  Sparkles, 
  Send, 
  Lock, 
  ArrowRight, 
  Bot, 
  User, 
  RotateCcw,
  Calendar,
  CheckCircle2
} from 'lucide-react';

const STORAGE_KEY = 'vyta_covyta_daily_chats_v2';

export const CoVytaScreen: React.FC = () => {
  const { selectedDay, setSelectedDay, covytaActive, openModal } = useApp();

  const dayInfo = WEEK[selectedDay] || WEEK[TODAY_INDEX];
  const dayData = weekMetrics[selectedDay] || weekMetrics[TODAY_INDEX];

  // Daily chats storage keyed by day index (0: Lundi 12, 1: Mardi 13, 2: Mercredi 14, 3: Jeudi 15)
  const [dailyChats, setDailyChats] = useState<Record<number, ChatMessage[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignorer erreur de parsing
    }
    return seedChatsByDay;
  });

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

  // Sauvegarde automatique à chaque mise à jour des conversations
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dailyChats));
    } catch (e) {
      console.warn('Erreur de sauvegarde locale CoVyta:', e);
    }
  }, [dailyChats]);

  const currentMessages = dailyChats[selectedDay] || [];
  const currentInsights = dailyInsights[selectedDay] || dailyInsights[TODAY_INDEX];
  const currentQuickQuestions = quickQuestionsByDay[selectedDay] || quickQuestionsByDay[TODAY_INDEX];

  const formatCurrentTime = () => {
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleSendPrompt = (text: string) => {
    if (!text.trim()) return;

    if (!covytaActive) {
      openModal('subscribe');
      return;
    }

    const timeStr = formatCurrentTime();
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timeStr,
    };

    // Ajout immédiat du message utilisateur à la journée sélectionnée
    setDailyChats((prev) => ({
      ...prev,
      [selectedDay]: [...(prev[selectedDay] || []), userMsg],
    }));
    setInputPrompt('');
    setIsTyping(true);

    // Recherche de réponse pertinente ou génération contextuelle liée au jour actif
    const matched = currentQuickQuestions?.find(
      (q) => q.label.toLowerCase() === text.toLowerCase() || text.toLowerCase().includes(q.label.slice(0, 10).toLowerCase())
    );

    setTimeout(() => {
      setIsTyping(false);
      let aiResponse = '';

      if (matched) {
        aiResponse = matched.answer;
      } else {
        // Réponse physiologique contextualisée selon la journée sélectionnée
        if (selectedDay === TODAY_INDEX) {
          aiResponse = `D'après vos signaux du ${dayInfo.long} 15 (vitalité ${dayData.score}/100, FC repos ${dayData.restingBpm} bpm, Body Energy ${dayData.bodyEnergy} %), votre système est réactif mais votre anomalie thermique (+0,4 °C) conseille 500 ml d'eau fraîche, une charge allégée et un coucher strict à 22h45.`;
        } else if (selectedDay === 2) {
          aiResponse = `Pour votre journée du Mercredi 14 : Votre récupération a été notée à 91 % avec 1h46 de sommeil profond et 9 120 pas. Votre VFC nocturne (71 ms) a parfaitement équilibré votre charge sportive.`;
        } else if (selectedDay === 1) {
          aiResponse = `Concernant le Mardi 13 : Avec un score de 79/100 et un coucher tardif (23h40), la VFC était descendue à 61 ms. Les 6 980 pas de marche ont constitué la bonne stratégie de récupération active.`;
        } else {
          aiResponse = `Pour le Lundi 12 : Début de semaine vigoureux avec 10 240 pas, un score de 86/100 et une VFC optimale à 69 ms. Votre charge était parfaitement proportionnée.`;
        }
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiResponse,
        timeStr: formatCurrentTime(),
      };

      setDailyChats((prev) => ({
        ...prev,
        [selectedDay]: [...(prev[selectedDay] || []), aiMsg],
      }));
    }, 550);
  };

  const handleResetDay = () => {
    if (window.confirm(`Réinitialiser la conversation du ${dayInfo.long} ${dayInfo.date} Octobre ?`)) {
      const defaultInitial = seedChatsByDay[selectedDay] || [
        {
          id: `init-${selectedDay}`,
          sender: 'ai',
          timeStr: '08:00',
          text: `Bonjour Alexandre. Je suis à votre écoute pour analyser vos signaux physiologiques du ${dayInfo.long} ${dayInfo.date} Octobre.`,
        },
      ];

      setDailyChats((prev) => ({
        ...prev,
        [selectedDay]: defaultInitial,
      }));
    }
  };

  return (
    <div className="screen-content">
      {/* 1. Titre & Sous-titre Calendaire identique à l'écran Aujourd'hui */}
      <div style={{ paddingTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <span className="header-subtitle">
              {dayInfo.long.toUpperCase()} {dayInfo.date} OCTOBRE
            </span>
            <h1 className="header-title">
              {selectedDay === TODAY_INDEX ? "Aujourd'hui" : selectedDay === TODAY_INDEX - 1 ? 'Hier' : dayInfo.long}
            </h1>
          </div>

          {/* Badge CoVyta IA en haut à droite */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, rgba(77, 11, 32, 0.45), rgba(201, 166, 107, 0.15))',
                border: '1px solid var(--gold-border)',
                borderRadius: '8px',
                padding: '4px 9px',
              }}
            >
              <Sparkles size={12} color="var(--gold)" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold-light)', letterSpacing: '0.04em' }}>
                CoVyta IA
              </span>
            </div>

            {covytaActive ? (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#30D158',
                  background: 'rgba(48, 209, 88, 0.12)',
                  border: '1px solid rgba(48, 209, 88, 0.25)',
                  padding: '4px 7px',
                  borderRadius: '8px',
                }}
              >
                Actif
              </span>
            ) : (
              <button
                type="button"
                onClick={() => openModal('subscribe')}
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--gold-light)',
                  background: 'rgba(201, 166, 107, 0.12)',
                  border: '1px solid var(--gold-border)',
                  padding: '4px 7px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Découverte
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Barre de Sélection de Semaine (L 12 - M 13 - M 14 - J 15 - V 16 - S 17 - D 18) */}
      <WeekSelector />

      {/* 3. Carte de Recommandations & Diagnostic Biométrique du Jour */}
      <div className="covyta-hero-banner">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="var(--gold)" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold-light)', letterSpacing: '0.04em' }}>
              {selectedDay === TODAY_INDEX
                ? 'RECOMMANDATIONS DU JOUR'
                : `SYNTHÈSE DU ${dayInfo.long.toUpperCase()} ${dayInfo.date}`}
            </span>
          </div>

          <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
            {selectedDay === TODAY_INDEX ? "Mis à jour à l'instant" : 'Journée archivée'}
          </span>
        </div>

        <p style={{ fontSize: '13px', color: '#FFFFFF', margin: '4px 0 0 0', lineHeight: 1.5 }}>
          {selectedDay === TODAY_INDEX
            ? "Croisement des données : Sommeil Profond 1h52 · VFC 74 ms · Taux d'Oxygène 98,6 %"
            : `Score de vitalité ${dayData.score}/100 · Sommeil ${dayData.sleep.deepMin}m profond · VFC ${dayData.hrv} ms`}
        </p>

        {/* Grille de 4 insights du jour */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
          {currentInsights.map((ins) => (
            <div
              key={ins.id}
              style={{
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{ins.title}</span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: ins.id === 'bed' ? 'var(--gold-light)' : '#FFFFFF',
                }}
              >
                {ins.value}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: 1.3, marginTop: '2px' }}>
                {ins.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bannière abonnement si CoVyta est inactif */}
      {!covytaActive && (
        <div
          className="glass-panel"
          style={{
            padding: '14px 16px',
            borderColor: 'var(--gold-border)',
            background: 'rgba(184, 35, 72, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Lock size={16} color="var(--gold)" />
            <div>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FFFFFF', display: 'block' }}>
                Mode Découverte
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Activez CoVyta pour dialoguer en temps réel avec votre santé
              </span>
            </div>
          </div>

          <button
            type="button"
            className="covyta-lock-cta"
            onClick={() => openModal('subscribe')}
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            <span>5,99 €</span>
            <ArrowRight size={11} />
          </button>
        </div>
      )}

      {/* 4. Section Conversation Enregistrée par Jour */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Barre d'état de l'historique quotidien */}
        <div className="chat-day-status-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={13} color="var(--gold)" />
            <span style={{ fontWeight: 600, color: '#FFFFFF' }}>
              Conversation du {dayInfo.long} {dayInfo.date} Octobre
            </span>
            <span style={{ fontSize: '9.5px', color: '#30D158', background: 'rgba(48, 209, 88, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
              ● Enregistré par jour
            </span>
          </div>

          <button
            type="button"
            className="chat-reset-btn"
            onClick={handleResetDay}
            title="Réinitialiser l'échange de cette journée"
          >
            <RotateCcw size={11} />
            <span>Effacer</span>
          </button>
        </div>

        {/* Questions Rapides (1-Clic) adaptées à la journée */}
        <div className="covyta-quick-chips">
          {currentQuickQuestions?.map((q) => (
            <button
              key={q.id}
              type="button"
              className="quick-chip-btn"
              onClick={() => handleSendPrompt(q.label)}
            >
              <span>{q.label}</span>
              <Sparkles size={12} color="var(--gold)" />
            </button>
          ))}
        </div>

        {/* Fil de discussion de la journée sélectionnée */}
        <div className="chat-thread" style={{ marginTop: '4px' }}>
          {currentMessages.map((m) => (
            <div
              key={m.id}
              className={`chat-bubble ${m.sender === 'user' ? 'user' : 'ai gold'}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                {m.sender === 'ai' ? (
                  <>
                    <Sparkles size={11} color="var(--gold)" />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold-light)', letterSpacing: '0.04em' }}>
                      COVYTA IA
                    </span>
                  </>
                ) : (
                  <>
                    <User size={11} color="#000000" />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#000000' }}>
                      VOUS
                    </span>
                  </>
                )}
              </div>

              <div>{m.text}</div>

              <div className="chat-bubble-footer">
                <span style={{ fontFamily: 'var(--font-mono)' }}>{m.timeStr || '10:00'}</span>
                <CheckCircle2 size={10} color={m.sender === 'user' ? '#000000' : 'var(--gold)'} />
              </div>
            </div>
          ))}

          {/* Indicateur de saisie en temps réel */}
          {isTyping && (
            <div className="chat-bubble ai gold" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '11px', color: 'var(--gold-light)', marginRight: '4px' }}>CoVyta analyse vos signaux</span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulseWarn 1s infinite' }} />
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulseWarn 1s infinite 200ms' }} />
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulseWarn 1s infinite 400ms' }} />
            </div>
          )}
        </div>

        {/* Barre de Saisie du Message */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt(inputPrompt);
          }}
          className="chat-input-bar"
        >
          <input
            type="text"
            className="chat-input"
            placeholder={
              covytaActive 
                ? `Poser une question pour le ${dayInfo.long} ${dayInfo.date}...` 
                : 'Activez CoVyta pour poser une question...'
            }
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
          />
          <button type="submit" className="chat-send-btn" title="Envoyer">
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};
