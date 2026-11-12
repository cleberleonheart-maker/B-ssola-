import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateKey } from '../src/utils/storage';

/**
 * A migração das chaves de armazenamento.
 *
 * O AsyncStorage mudou de chave mais do que uma vez (o idioma, as preferências
 * da assistente, a memória da nuvem). A migração copia o valor antigo para o
 * novo e apaga o antigo — mas o que interessa é o que acontece quando o
 * armazenamento está a falhar: a app tem de abrir na mesma, e não com o
 * ecrã partido por causa de uma chave antiga que não se consegue ler.
 */

describe('migrateKey', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('sem nada guardado nao ha valor', async () => {
    expect(await migrateKey('@velha', '@nova')).toBeNull();
  });

  it('copia o valor antigo para a chave nova', async () => {
    await AsyncStorage.setItem('@velha', 'conteudo');

    expect(await migrateKey('@velha', '@nova')).toBe('conteudo');
    expect(await AsyncStorage.getItem('@nova')).toBe('conteudo');
  });

  it('apaga a chave antiga depois de migrar', async () => {
    await AsyncStorage.setItem('@velha', 'conteudo');

    await migrateKey('@velha', '@nova');

    expect(await AsyncStorage.getItem('@velha')).toBeNull();
  });

  it('se a chave nova ja existe, ganha ela e a antiga fica como estava', async () => {
    await AsyncStorage.setItem('@nova', 'novo');
    await AsyncStorage.setItem('@velha', 'antigo');

    expect(await migrateKey('@velha', '@nova')).toBe('novo');
    // A antiga não se apaga: pode ser o que outra versão da app ainda vai
    // ler, e apagar sem querer é pior do que deixar.
    expect(await AsyncStorage.getItem('@velha')).toBe('antigo');
  });

  it('um armazenamento partido devolve null em vez de rebentar', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValue(new Error('disco cheio'));

    expect(await migrateKey('@velha', '@nova')).toBeNull();

    spy.mockRestore();
  });

  it('um armazenamento partido ao gravar tambem devolve null', async () => {
    await AsyncStorage.setItem('@velha', 'conteudo');
    const spy = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValue(new Error('disco cheio'));

    expect(await migrateKey('@velha', '@nova')).toBeNull();

    spy.mockRestore();
  });
});
