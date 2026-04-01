import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { Search, Plus, Book, Clock, Edit3, Trash2, X, Download, Cloud, Check, Loader2 } from 'lucide-react';

// Configuración de Firebase - Proporcionada por el entorno
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'glosario-empresarial-v1';

export default function App() {
  const [words, setWords] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ term: '', definition: '', status: 'defined' });

  // 1. Manejo de Autenticación (Regla 3: Auth antes de consultas)
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

  // 2. Sincronización con Firestore (Regla 1: Rutas estrictas)
  useEffect(() => {
    if (!user) return;

    // Usando la ruta obligatoria: /artifacts/{appId}/public/data/{collectionName}
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

  // Filtrado y ordenación en memoria (Regla 2: No consultas complejas)
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

    const finalStatus = formData.definition.trim() === '' ? 'pending' : formData.status;
    const wordData = { 
      term: formData.term, 
      definition: formData.definition, 
      status: finalStatus,
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
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'vocabulary', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  };

  const exportToCSV = () => {
    const headers = ['Palabra', 'Definición', 'Estado'];
    const rows = words.map(w => [
      `"${(w.term || '').replace(/"/g, '""')}"`, 
      `"${(w.definition || '').replace(/"/g, '""')}"`, 
      w.status
    ]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "glosario_empresa.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Sincronizando glosario corporativo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      <header className="bg-indigo-700 text-white shadow-lg py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Book className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none">Glosario Corporativo</h1>
              <div className="flex items-center gap-1 text-indigo-200 text-xs mt-1">
                <Cloud className="w-3 h-3" />
                <span>Datos guardados en la nube</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-indigo-600/50 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-white/20"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
            <button 
              onClick={() => {
                setEditingId(null);
                setFormData({ term: '', definition: '', status: 'defined' });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-white text-indigo-700 px-4 py-2 rounded-lg font-bold hover:bg-indigo-50 transition-all shadow-md active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Nueva Palabra
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 mt-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar término o definición..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'Todo', count: words.length },
              { id: 'defined', label: 'Definidas', count: words.filter(w => w.status === 'defined').length },
              { id: 'pending', label: 'Por Investigar', count: words.filter(w => w.status === 'pending').length }
            ].map(btn => (
              <button 
                key={btn.id}
                onClick={() => setFilter(btn.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap uppercase tracking-wider transition-all ${filter === btn.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {btn.label} • {btn.count}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          {filteredWords.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <Book className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">No se encontraron términos en esta categoría.</p>
            </div>
          ) : (
            filteredWords.map((word) => (
              <div key={word.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 transition-all group relative overflow-hidden">
                {word.status === 'pending' && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400" />}
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-slate-800">{word.term}</h3>
                      {word.status === 'pending' && (
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                    </div>
                    <p className={`${word.status === 'pending' ? 'text-slate-400 italic' : 'text-slate-600'} text-sm leading-relaxed`}>
                      {word.definition || "Sin definición. Haz clic en editar para agregar una."}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingId(word.id);
                        setFormData({ term: word.term, definition: word.definition || '', status: word.status });
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(word.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Editar Término' : 'Nuevo Término'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><X /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1 tracking-widest">Palabra / Siglas</label>
                <input 
                  type="text" required value={formData.term}
                  onChange={(e) => setFormData({...formData, term: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ej: KPI, SEO, Core Business..."
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="block text-xs font-black uppercase text-slate-500 tracking-widest">Significado</label>
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, definition: '', status: 'pending'})}
                    className="text-[10px] text-amber-600 font-bold hover:underline"
                  >
                    Marcar como pendiente
                  </button>
                </div>
                <textarea 
                  value={formData.definition}
                  onChange={(e) => setFormData({...formData, definition: e.target.value, status: 'defined'})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none"
                  placeholder={formData.status === 'pending' ? 'Este término aparecerá como "Por investigar"...' : 'Escribe la definición aquí...'}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-[2] px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                  {editingId ? 'Actualizar' : 'Guardar Término'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
