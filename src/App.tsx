import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { Bot, Server, Plus, Trash2, Settings, ExternalLink, MessageSquare, Shield, LogOut, Layout, ChevronRight, Check, AlertCircle, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Navbar = () => {
  return (
    <nav className="glass-nav px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2">
        <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-900/20">
          <Shield className="text-white w-6 h-6" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">Saddam <span className="text-pink-500">Ticket</span></span>
      </Link>
      
      <div className="flex items-center gap-4">
        <div className="text-zinc-400 text-sm font-medium hidden md:block">
          Professional Discord Support System
        </div>
      </div>
    </nav>
  );
};

const BotCard = ({ bot, onDelete }: { bot: any, onDelete: (id: string) => void }) => {
  return (
    <div className="glass-card rounded-2xl p-6 hover:border-pink-500/50 transition-all group">
      <div className="flex items-center gap-4 mb-6">
        <img src={bot.avatar} alt="" className="w-16 h-16 rounded-2xl shadow-xl border border-white/10" referrerPolicy="no-referrer" />
        <div>
          <h3 className="text-lg font-bold text-white group-hover:text-pink-500 transition-colors">{bot.name}</h3>
          <p className="text-zinc-500 text-sm font-mono">{bot.botId}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Link 
          to={`/bot/${bot.id}`}
          className="flex-1 bg-white/5 hover:bg-pink-600/20 text-white py-2.5 rounded-xl font-medium text-center transition-all border border-white/5 flex items-center justify-center gap-2"
        >
          <Settings size={18} className="group-hover:text-pink-500" /> Manage
        </Link>
        <button 
          onClick={() => onDelete(bot.id)}
          className="p-2.5 bg-white/5 hover:bg-red-900/30 text-zinc-400 hover:text-red-500 rounded-xl transition-colors border border-white/5"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};

// --- Pages ---

const Home = () => {
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'bots'));
      
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this bot?')) {
      await deleteDoc(doc(db, 'bots', id));
    }
  };

  // Removed the mandatory login check to allow direct access to the dashboard

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Bots</h1>
          <p className="text-zinc-400">Manage your connected Discord bots</p>
        </div>
        <Link 
          to="/add-bot"
          className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-pink-900/20 flex items-center gap-2"
        >
          <Plus size={20} /> Add New Bot
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-pink-500 w-10 h-10" />
        </div>
      ) : bots.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map(bot => (
            <BotCard key={bot.id} bot={bot} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
            <Bot className="text-zinc-500 w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No bots added yet</h2>
          <p className="text-zinc-400 mb-8">Add your first Discord bot to start creating ticket panels.</p>
          <Link 
            to="/add-bot"
            className="text-pink-500 font-bold hover:text-pink-400 transition-colors"
          >
            Connect a bot &rarr;
          </Link>
        </div>
      )}
    </div>
  );
};

const AddBot = () => {
  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [botPreview, setBotPreview] = useState<any>(null);
  const navigate = useNavigate();

  const handleVerify = async () => {
    if (!token) return;
    setVerifying(true);
    setError('');
    try {
      const res = await fetch('/api/discord/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (res.ok) {
        setBotPreview(data);
      } else {
        setError(data.error || 'Failed to verify token');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!botPreview) return;
    try {
      await setDoc(doc(db, 'bots', botPreview.id), {
        botId: botPreview.id,
        name: botPreview.username,
        avatar: botPreview.avatar,
        token: token,
        ownerUid: 'public',
        createdAt: new Date().toISOString()
      });
      navigate('/');
    } catch (err) {
      setError('Failed to save bot to database');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link to="/" className="text-zinc-400 hover:text-white flex items-center gap-2 mb-6 transition-colors">
          <ChevronRight className="rotate-180" size={18} /> Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">Add New Bot</h1>
        <p className="text-zinc-400">Enter your Discord bot token to connect it to Saddam Ticket.</p>
      </div>

      <div className="glass-card rounded-3xl p-8">
        <div className="mb-8">
          <label className="block text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Bot Token</label>
          <div className="flex gap-3">
            <input 
              type="password" 
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="MTA..."
              className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition-colors"
            />
            <button 
              onClick={handleVerify}
              disabled={verifying || !token}
              className="bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
            >
              {verifying ? <Loader2 className="animate-spin" size={20} /> : 'Verify'}
            </button>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle size={18} /> {error}
            </div>
          )}
        </div>

        {botPreview && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-black/20 border border-white/10 rounded-2xl p-6 mb-8 flex items-center gap-6">
              <img src={botPreview.avatar} alt="" className="w-20 h-20 rounded-2xl shadow-2xl border border-white/10" referrerPolicy="no-referrer" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold text-white">{botPreview.username}</h3>
                  <span className="bg-pink-600 text-[10px] font-bold px-1.5 py-0.5 rounded text-white uppercase">Bot</span>
                </div>
                <p className="text-zinc-500 font-mono text-sm">{botPreview.id}</p>
                <div className="mt-2 flex items-center gap-2 text-green-400 text-sm font-medium">
                  <Check size={16} /> Token Verified Successfully
                </div>
              </div>
            </div>
            <button 
              onClick={handleSave}
              className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white py-4 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-pink-900/20"
            >
              Confirm & Add Bot
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 glass-card rounded-2xl">
        <h4 className="text-white font-bold mb-2 flex items-center gap-2">
          <Shield className="text-pink-500" size={18} /> Security Note
        </h4>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Your token is used only to interact with the Discord API on your behalf. We recommend using a dedicated bot for this service and ensuring it has the necessary permissions (Manage Channels, Send Messages, Embed Links).
        </p>
      </div>
    </div>
  );
};

const BotDetails = () => {
  const { botId } = useParams();
  const [bot, setBot] = useState<any>(null);
  const [guilds, setGuilds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!botId) return;
    const fetchBot = async () => {
      const docRef = doc(db, 'bots', botId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBot(data);
        
        // Fetch guilds
        try {
          const res = await fetch('/api/discord/guilds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: data.token })
          });
          const guildData = await res.json();
          if (res.ok) setGuilds(guildData);
          else setError('Failed to fetch servers');
        } catch (err) {
          setError('Connection error');
        }
      } else {
        navigate('/');
      }
      setLoading(false);
    };
    fetchBot();
  }, [botId]);

  if (loading) return (
    <div className="flex justify-center py-40">
      <Loader2 className="animate-spin text-pink-500 w-12 h-12" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="flex items-center gap-6">
          <img src={bot?.avatar} alt="" className="w-24 h-24 rounded-3xl shadow-2xl border border-white/10" referrerPolicy="no-referrer" />
          <div>
            <Link to="/" className="text-zinc-400 hover:text-white flex items-center gap-1 mb-2 transition-colors text-sm">
              <ChevronRight className="rotate-180" size={14} /> Dashboard
            </Link>
            <h1 className="text-4xl font-black text-white">{bot?.name}</h1>
            <p className="text-zinc-400 mt-1">Select a server to create a ticket panel</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {guilds.map(guild => (
          <div key={guild.id} className="glass-card rounded-2xl p-6 hover:border-pink-500/50 transition-all group">
            <div className="flex items-center gap-4 mb-6">
              {guild.icon ? (
                <img src={guild.icon} alt="" className="w-14 h-14 rounded-2xl shadow-lg" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-xl font-bold text-zinc-500 border border-white/10">
                  {guild.name?.charAt(0) || '?'}
                </div>
              )}
              <h3 className="text-lg font-bold text-white truncate flex-1">{guild.name}</h3>
            </div>
            <Link 
              to={`/bot/${botId}/guild/${guild.id}`}
              className="w-full bg-white/5 hover:bg-pink-600 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-white/5"
            >
              Configure Panel <ChevronRight size={18} />
            </Link>
          </div>
        ))}
      </div>

      {guilds.length === 0 && !error && (
        <div className="glass-card rounded-3xl p-12 text-center">
          <AlertCircle className="text-zinc-500 w-12 h-12 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No servers found</h2>
          <p className="text-zinc-400">Make sure your bot is invited to at least one server.</p>
          <a 
            href={`https://discord.com/api/oauth2/authorize?client_id=${bot?.botId}&permissions=8&scope=bot%20applications.commands`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 text-pink-500 font-bold hover:underline"
          >
            Invite Bot to Server
          </a>
        </div>
      )}
    </div>
  );
};

const PanelBuilder = () => {
  const { botId, guildId } = useParams();
  const [bot, setBot] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [selectedChannel, setSelectedChannel] = useState('');
  const [title, setTitle] = useState('Support Ticket');
  const [description, setDescription] = useState('Click a button below to open a new support ticket.');
  const [imageUrl, setImageUrl] = useState('');
  const [panelType, setPanelType] = useState<'buttons' | 'select'>('buttons');
  const [placeholder, setPlaceholder] = useState('اختر قسم التذكرة...');
  const [buttons, setButtons] = useState([{ label: 'الدعم الفني', description: 'إنشاء تذكرة للدعم الفني', value: 'support' }]);
  const [panelColor, setPanelColor] = useState('#F27D26');
  const [supportRoles, setSupportRoles] = useState<string[]>([]);
  const [mentionRoles, setMentionRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (!botId || !guildId) return;
    const fetchData = async () => {
      setError('');
      const docRef = doc(db, 'bots', botId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const botData = docSnap.data();
        if (!botData) {
          setError('لم يتم العثور على بيانات البوت.');
          setLoading(false);
          return;
        }
        setBot(botData);
        
        try {
          const res = await fetch('/api/discord/channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: botData.token, guildId })
          });
          if (!res.ok) throw new Error('فشل جلب القنوات');
          const channelData = await res.json();
          setChannels(channelData);

          // Fetch roles
          const rolesRes = await fetch('/api/discord/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: botData.token, guildId })
          });
          if (!rolesRes.ok) throw new Error('فشل جلب الرولات');
          const rolesData = await rolesRes.json();
          setAvailableRoles(rolesData);
        } catch (err: any) { 
          console.error(err);
          setError('حدث خطأ أثناء الاتصال بديسكورد. تأكد من توكن البوت وصلاحياته.');
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [botId, guildId]);

  const handleAddButton = () => {
    if (buttons.length < 25) {
      setButtons([...buttons, { label: 'New Option', description: '', value: `option_${buttons.length}` }]);
    }
  };

  const handleSend = async () => {
    if (!selectedChannel || !bot) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/discord/send-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: bot.token,
          guildId,
          channelId: selectedChannel,
          title,
          description,
          imageUrl,
          buttons,
          panelType,
          placeholder,
          color: panelColor,
          supportRoles,
          mentionRoles
        })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => navigate(`/bot/${botId}`), 2000);
      } else {
        const data = await res.json();
        setError(data.error || 'فشل إرسال اللوحة');
      }
    } catch (err) { 
      console.error(err);
      setError('خطأ في الاتصال بالسيرفر');
    }
    finally { setSending(false); }
  };

  if (loading) return <div className="flex justify-center py-40"><Loader2 className="animate-spin text-pink-500 w-12 h-12" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12">
        <Link to={`/bot/${botId}`} className="text-zinc-400 hover:text-white flex items-center gap-1 mb-4 transition-colors text-sm">
          <ChevronRight className="rotate-180" size={14} /> Back to Servers
        </Link>
        <h1 className="text-4xl font-black text-white">Panel Builder</h1>
        <p className="text-zinc-400 mt-1">Customize your ticket embed and interaction type</p>
        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center gap-3 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={18} /> {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Editor */}
        <div className="space-y-8">
          <div className="glass-card rounded-3xl p-8 space-y-6">
            <div className="flex bg-black/20 p-1 rounded-xl border border-white/10">
              <button 
                onClick={() => setPanelType('buttons')}
                className={cn(
                  "flex-1 py-2 rounded-lg font-bold text-sm transition-all",
                  panelType === 'buttons' ? "bg-pink-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Buttons
              </button>
              <button 
                onClick={() => setPanelType('select')}
                className={cn(
                  "flex-1 py-2 rounded-lg font-bold text-sm transition-all",
                  panelType === 'select' ? "bg-pink-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Select Menu
              </button>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Target Channel</label>
              <select 
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500"
              >
                <option value="">Select a channel...</option>
                {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </div>

            {panelType === 'select' && (
              <div>
                <label className="block text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Menu Placeholder</label>
                <input 
                  type="text" 
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Embed Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Embed Description</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Image URL (Optional)</label>
              <input 
                type="text" 
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Embed Color</label>
                <div className="flex gap-3">
                  <input 
                    type="color" 
                    value={panelColor}
                    onChange={(e) => setPanelColor(e.target.value)}
                    className="w-12 h-12 bg-black/20 border border-white/10 rounded-xl cursor-pointer p-1"
                  />
                  <input 
                    type="text" 
                    value={panelColor}
                    onChange={(e) => setPanelColor(e.target.value)}
                    className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white font-mono uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Support Roles</label>
                <div className="bg-black/20 border border-white/10 rounded-xl p-4 max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                  {availableRoles.map(role => (
                    <label key={role.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={supportRoles.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSupportRoles([...supportRoles, role.id]);
                          else setSupportRoles(supportRoles.filter(id => id !== role.id));
                        }}
                        className="w-4 h-4 rounded border-white/10 bg-black/20 text-pink-600 focus:ring-pink-500 focus:ring-offset-zinc-950"
                      />
                      <span style={{ color: role.color !== '#000000' ? role.color : '#fff' }} className="text-sm font-medium">
                        {role.name}
                      </span>
                    </label>
                  ))}
                  {availableRoles.length === 0 && <p className="text-zinc-600 text-xs text-center py-4">No roles found</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Mention Roles</label>
                <div className="bg-black/20 border border-white/10 rounded-xl p-4 max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                  {availableRoles.map(role => (
                    <label key={role.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={mentionRoles.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) setMentionRoles([...mentionRoles, role.id]);
                          else setMentionRoles(mentionRoles.filter(id => id !== role.id));
                        }}
                        className="w-4 h-4 rounded border-white/10 bg-black/20 text-pink-600 focus:ring-pink-500 focus:ring-offset-zinc-950"
                      />
                      <span style={{ color: role.color !== '#000000' ? role.color : '#fff' }} className="text-sm font-medium">
                        {role.name}
                      </span>
                    </label>
                  ))}
                  {availableRoles.length === 0 && <p className="text-zinc-600 text-xs text-center py-4">No roles found</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-8">
            <div className="flex items-center justify-between mb-6">
              <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                {panelType === 'buttons' ? 'Buttons (Max 5)' : 'Options (Max 25)'}
              </label>
              <button 
                onClick={handleAddButton}
                disabled={panelType === 'buttons' ? buttons.length >= 5 : buttons.length >= 25}
                className="text-pink-500 font-bold text-sm hover:text-pink-400 disabled:opacity-50"
              >
                + Add {panelType === 'buttons' ? 'Button' : 'Option'}
              </button>
            </div>
            <div className="space-y-4">
              {buttons.map((btn, idx) => (
                <div key={idx} className="bg-black/20 border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex gap-3 items-center">
                    <input 
                      type="text" 
                      value={btn.label}
                      onChange={(e) => {
                        const newBtns = [...buttons];
                        newBtns[idx].label = e.target.value;
                        setButtons(newBtns);
                      }}
                      placeholder="Label"
                      className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
                    />
                    <button 
                      onClick={() => setButtons(buttons.filter((_, i) => i !== idx))}
                      className="text-zinc-500 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {panelType === 'select' && (
                    <input 
                      type="text" 
                      value={btn.description}
                      onChange={(e) => {
                        const newBtns = [...buttons];
                        newBtns[idx].description = e.target.value;
                        setButtons(newBtns);
                      }}
                      placeholder="Description (Optional)"
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-pink-500"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={handleSend}
            disabled={sending || !selectedChannel || success}
            className={cn(
              "w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-3",
              success ? "bg-green-600 text-white" : "bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-pink-900/20"
            )}
          >
            {sending ? <Loader2 className="animate-spin" /> : success ? <><Check /> Panel Sent!</> : 'Send Panel to Discord'}
          </button>
        </div>

        {/* Preview */}
        <div className="sticky top-32 h-fit">
          <label className="block text-sm font-bold text-zinc-400 mb-6 uppercase tracking-wider">Live Preview</label>
          <div className="bg-[#313338] rounded-lg p-4 shadow-2xl border border-white/5">
            <div className="flex gap-4">
              <img src={bot?.avatar} alt="" className="w-10 h-10 rounded-full border border-white/10" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium hover:underline cursor-pointer">{bot?.name}</span>
                  <span className="bg-[#5865F2] text-[10px] font-bold px-1 py-0.5 rounded-[3px] text-white flex items-center gap-0.5">
                    <Check size={10} /> BOT
                  </span>
                  <span className="text-[#949BA4] text-xs">Today at 12:00 PM</span>
                </div>
                
                <div className="mt-1 border-l-4 bg-[#2B2D31] rounded-r-md p-3 max-w-[432px]" style={{ borderLeftColor: panelColor }}>
                  {title && <h4 className="text-white font-bold mb-2">{title}</h4>}
                  {description && <p className="text-[#DBDEE1] text-sm whitespace-pre-wrap">{description}</p>}
                  {imageUrl && <img src={imageUrl} alt="" className="mt-3 rounded-md max-h-80 object-cover w-full" />}
                </div>

                <div className="mt-2">
                  {panelType === 'buttons' ? (
                    <div className="flex flex-wrap gap-2">
                      {buttons.map((btn, idx) => (
                        <div key={idx} className="bg-[#4E5058] hover:bg-[#6D6F78] text-white px-4 py-1.5 rounded-[3px] text-sm font-medium cursor-pointer transition-colors">
                          {btn.label || 'Button'}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[#2B2D31] border border-black/20 rounded-[4px] p-2 flex items-center justify-between text-[#B5BAC1] text-sm cursor-pointer hover:bg-[#35373C]">
                      <span>{placeholder}</span>
                      <ChevronRight className="rotate-90" size={16} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <p className="text-zinc-500 text-xs mt-4 text-center italic">This is a visual simulation of how it will look in Discord.</p>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <Router>
      <div className="min-h-screen text-zinc-100 font-sans selection:bg-pink-500/30 selection:text-pink-500">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/add-bot" element={<AddBot />} />
            <Route path="/bot/:botId" element={<BotDetails />} />
            <Route path="/bot/:botId/guild/:guildId" element={<PanelBuilder />} />
          </Routes>
        </main>
        
        <footer className="border-t border-white/5 py-12 mt-20 glass-nav">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2 opacity-50">
              <Shield size={20} className="text-pink-500" />
              <span className="font-bold">Saddam <span className="text-pink-500">Ticket</span></span>
            </div>
            <div className="flex gap-8 text-zinc-400 text-sm font-medium">
              <a href="#" className="hover:text-pink-500 transition-colors">Terms</a>
              <a href="#" className="hover:text-pink-500 transition-colors">Privacy</a>
              <a href="#" className="hover:text-pink-500 transition-colors">Support</a>
            </div>
            <p className="text-zinc-500 text-sm">&copy; 2026 Saddam Ticket. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}
