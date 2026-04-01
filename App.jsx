import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { Search, Plus, Book, Clock, Edit3, Trash2, X, Download, Cloud, Check, Loader2, AlertCircle } from 'lucide-react';

// Configuración de Firebase - Proporcionada por el entorno
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'glosario-v1';

export default function App() {
  const [words, setWords] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ term: '', definition: '', status: 'defined' });

  // Manejo de Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error de autenticación:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Sincronización con Firestore
  useEffect(() => {
    if (!user) return;

    const q = collection(db, 'artifacts', appId, 'public', 'data', 'vocabulary');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const wordsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setWords(wordsData);
      setLoading(false);
    }, (error) => {
      console.error("Error obteniendo datos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Filtrado y ordenación
  const filteredWords = words.filter(w => {
    const termMatch = (w.term || '').toLowerCase().includes(searchTerm.toLowerCase());
    const defMatch = (w.definition || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = termMatch || defMatch;
    const matchesFilter = filter === 'all' || w.status === filter;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => (a.term || '').localeCompare(b.term || ''));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.term.trim() || !user) return;

    const isPending = formData.definition.trim() === '';
    const wordData = { 
      term: formData.term, 
      definition: formData.definition, 
      status: isPending ? 'pending' : 'defined',
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'vocabulary', editingId);
        await updateDoc(docRef, wordData);
      } else {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'vocabulary');
        await addDoc(colRef, wordData);
      }
      setIsModalOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error("Error al guardar:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!user || !window.confirm("¿Eliminar este término?")) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'vocabulary', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const pendingCount = words.filter(w => w.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#f7fdfa] text-slate-800 font-sans pb-20">
      {/* Header Esmeralda - Descripción eliminada */}
      <header className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xl py-10 px-6 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4 text-left">
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20">
              <Book className="w-8 h-8 text-emerald-100 fill-emerald-100/10" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase">Glosario Corporativo de Sofía</h1>
            </div>
          </div>
          <button 
            onClick={() => { setEditingId(null); setFormData({ term: '', definition: '', status: 'defined' }); setIsModalOpen(true); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-emerald-700 px-8 py-4 rounded-2xl font-black hover:bg-emerald-50 transition-all shadow-lg active:scale-95 uppercase text-sm tracking-widest border-b-4 border-emerald-100"
          >
            <Plus className="w-5 h-5" /> Nueva Palabra
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 -mt-4">
        {/* Panel de Control */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-emerald-100 mb-8">
          <div className="relative mb-6">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-300 w-5 h-5" />
            <input 
              type="text" 
              placeholder="¿Qué palabra estás buscando?" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 rounded-2xl border border-emerald-50 bg-emerald-50/20 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-lg font-medium placeholder:text-emerald-200"
            />
          </div>
          
          <div className="flex flex-wrap gap-3">
            {[
              { id: 'all', label: 'Todo', count: words.length },
              { id: 'defined', label: 'Definidas', count: words.length - pendingCount },
              { id: 'pending', label: 'Dudas', count: pendingCount }
            ].map(btn => (
              <button 
                key={btn.id}
                onClick={() => setFilter(btn.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  filter === btn.id 
                  ? `bg-emerald-600 text-white shadow-md shadow-emerald-200` 
                  : 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100'
                }`}
              >
                {btn.label}
                <span className={`px-2 py-0.5 rounded-md ${filter === btn.id ? 'bg-white/20' : 'bg-emerald-200/50'}`}>
                  {btn.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Palabras */}
        <div className="grid gap-4">
          {filteredWords.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-emerald-100">
              <AlertCircle className="w-12 h-12 text-emerald-100 mx-auto mb-4" />
              <p className="text-emerald-300 font-bold uppercase tracking-widest text-xs">Aún no hay nada por aquí</p>
            </div>
          ) : (
            filteredWords.map((word) => (
              <div key={word.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden text-left">
                {word.status === 'pending' && <div className="absolute top-0 left-0 w-2 h-full bg-amber-400" />}
                
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-3">
                      <h3 className="text-xl font-black text-slate-800 tracking-tight group-hover:text-emerald-600 transition-colors">{word.term}</h3>
                      {word.status === 'pending' && (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase bg-amber-50 text-amber-600 px-2 py-1 rounded-lg">
                          <Clock className="w-3 h-3" /> Falta definir
                        </span>
                      )}
                    </div>
                    <p className={`${word.status === 'pending' ? 'text-emerald-300 italic' : 'text-slate-600'} leading-relaxed text-base`}>
                      {word.definition || "Anotamos este concepto para explicarlo pronto."}
                    </p>
                  </div>
                  
                  <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => { setEditingId(word.id); setFormData({ term: word.term, definition: word.definition || '', status: word.status }); setIsModalOpen(true); }}
                      className="p-3 text-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(word.id)}
                      className="p-3 text-emerald-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-emerald-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/50">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">{editingId ? 'Editar concepto' : 'Agregar algo nuevo'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-emerald-300 hover:bg-emerald-100 p-2 rounded-full transition-all"><X /></button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-8">
              <div className="text-left">
                <label className="block text-[10px] font-black uppercase text-emerald-400 mb-2 tracking-[0.2em]">Palabra o siglas</label>
                <input 
                  type="text" required value={formData.term}
                  onChange={(e) => setFormData({...formData, term: e.target.value})}
                  className="w-full px-6 py-4 rounded-2xl border border-emerald-50 bg-emerald-50/30 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none text-lg font-bold text-slate-800"
                  placeholder="¿Cómo se llama el término?"
                />
              </div>
              <div className="text-left">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em]">¿Qué significa?</label>
                  <span className="text-[9px] font-bold text-emerald-200 italic">Puedes dejarlo en blanco si no lo sabes aún</span>
                </div>
                <textarea 
                  value={formData.definition}
                  onChange={(e) => setFormData({...formData, definition: e.target.value})}
                  className="w-full px-6 py-4 rounded-2xl border border-emerald-50 bg-emerald-50/30 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none h-40 resize-none text-slate-600 leading-relaxed"
                  placeholder="Escribe la explicación de forma sencilla..."
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button 
                  type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 text-emerald-400 font-bold hover:bg-emerald-50 rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-[2] px-6 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all active:scale-95 uppercase tracking-widest text-sm border-b-4 border-emerald-800"
                >
                  {editingId ? 'Actualizar' : 'Listo, guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
