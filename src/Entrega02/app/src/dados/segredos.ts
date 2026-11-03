// O token da lançadora fica no cofre do aparelho (Keychain / Keystore), nunca
// no banco nem em texto claro (PRD §11, Cibersegurança).

import * as SecureStore from 'expo-secure-store';

const CHAVE_TOKEN = 'nockhug.token';
const CHAVE_JWT = 'nockhug.plataforma.jwt';

export const lerToken = () => SecureStore.getItemAsync(CHAVE_TOKEN);
export const salvarToken = (t: string) => SecureStore.setItemAsync(CHAVE_TOKEN, t.trim());
export const apagarToken = () => SecureStore.deleteItemAsync(CHAVE_TOKEN);

export const lerJwtPlataforma = () => SecureStore.getItemAsync(CHAVE_JWT);
export const salvarJwtPlataforma = (t: string) => SecureStore.setItemAsync(CHAVE_JWT, t.trim());
export const apagarJwtPlataforma = () => SecureStore.deleteItemAsync(CHAVE_JWT);
