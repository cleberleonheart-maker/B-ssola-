import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createNoteId,
  deleteNote,
  loadNotes,
  saveNote,
  type FieldNote,
} from '../src/services/notesService';

/**
 * Caderneta com rumo (#25).
 *
 * A direção da bússola no momento da foto tem de sobreviver ao
 * gravar/ler, porque é a única forma de a mostrar mais tarde. E uma
 * anotação antiga (gravada antes deste campo existir) não pode partir a
 * leitura — o `heading` fica ausente e o ecrã tem de o tolerar.
 */
const note = (over: Partial<FieldNote> = {}): FieldNote => ({
  id: createNoteId(),
  text: 'Achado',
  lat: 41.15,
  lon: -8.61,
  alt: 120,
  at: 1730000000000,
  photoPath: '/tmp/foto.jpg',
  heading: 137,
  cloudSynced: false,
  ...over,
});

describe('notesService — rumo', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('guarda e devolve o rumo da foto', async () => {
    await saveNote(note({ heading: 137 }));
    const [saved] = await loadNotes();
    expect(saved.heading).toBe(137);
  });

  it('gravacao mais recente fica a frente', async () => {
    await saveNote(note({ id: 'a', text: 'primeira' }));
    await saveNote(note({ id: 'b', text: 'segunda' }));
    const list = await loadNotes();
    expect(list.map(n => n.id)).toEqual(['b', 'a']);
  });

  it('tolera anotacao antiga sem o campo heading', async () => {
    const legado = note();
    delete (legado as Partial<FieldNote>).heading;
    await AsyncStorage.setItem('@bussola/fieldNotes', JSON.stringify([legado]));

    const [saved] = await loadNotes();
    expect(saved.heading).toBeUndefined();
  });

  it('apagar remove a anotacao e mantem as outras', async () => {
    await saveNote(note({ id: 'a' }));
    await saveNote(note({ id: 'b' }));
    const list = await deleteNote('a');
    expect(list.map(n => n.id)).toEqual(['b']);
  });
});
