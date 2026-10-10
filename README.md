# ⚓ MaréSegura — Tábua de Marés & Navegação Offline

> Sistema tático de previsão de marés astronômicas em tempo real, monitoramento de ondas oceânicas ao vivo, alertas de segurança para calado de embarcações e cartas náuticas com operação 100% offline.

---

## 🧭 Visão Geral

O **MaréSegura** é uma aplicação web progressiva desenvolvida sob a linguagem de design **Tactical Maritime (Variation 6)**, priorizando legibilidade tática de alto contraste, telemetria em tempo real e ausência de dados fictícios (*zero mock*).

Projetado para marinheiros, pescadores, velejadores e navegadores costeiros, o sistema integra harmônicos astronômicos oficiais da Marinha do Brasil (DHN) com a **Open-Meteo Marine API** e geolocalização do dispositivo.

---

## ✨ Funcionalidades Principais

### 1. 📍 Radar de Praia Mais Próxima (Fixado no Topo)
- **Detecção de GPS Real**: Identifica as coordenadas do dispositivo através de `navigator.geolocation`.
- **Cálculo Geodésico (Haversine)**: Determina a praia mais próxima com precisão métrica e conversão automática para Quilômetros ($km$) e Milhas Náuticas ($MN$).
- **Telemetria Imediata**: Exibe a altura da maré atual e a ondulação oceânica ao vivo para o local.

### 2. 🌊 Dados Oceanográficos Reais (Sem Mocks)
- **Open-Meteo Marine API**: Integração com modelos globais **NOAA WaveWatch III** e **ECMWF**:
  - Altura real de ondas e ondulação (*swell*) em metros.
  - Período de onda em segundos ($s$).
  - Direção angular da onda ($^\circ$) e intensidade do vento costeiro ($km/h$).
- **Harmônicos Astronômicos Reais**: Fórmulas com constituintes $M_2, S_2, N_2, K_1, O_1, M_4$ calibrados pelo **Zero Hidrográfico (DHN)**.

### 3. 🔎 Busca de Cidades e Praias
- **Autocomplete em Tempo Real**: Conexão com a API de Geocodificação aberta e base de praias brasileiras (Copacabana, Maresias, Porto de Galinhas, Praia do Forte, Jericoacoara, Joaquina, Ilhabela, Pipa, etc.).
- Permite pesquisar qualquer praia, município ou coordenada costeira no Brasil e no mundo.

### 4. 📐 Folga sob a Quilha (Under-Keel Clearance - UKC)
- Cálculo da profundidade real efetiva:
  $$\text{Profundidade Real} = \text{Sondagem da Carta (Datum)} + \text{Altura da Maré Atual}$$
- Subtrai o calado da embarcação (*draft*) e avisa se a margem de segurança foi violada.

### 5. 🚨 Alertas Personalizados & Áudio Marítimo
- Gatilhos para Baixa-mar crítica, Preia-mar máxima, Folga de quilha mínima e Maré de Sizígia.
- **Sintetizador Web Audio API** autônomo (sonar náutico, buzina de nevoeiro, sino de bordo e alarme de perigo).

### 6. 🗺️ Cartas Náuticas & Operação 100% Offline
- Camadas cartográficas com **OpenSeaMap** (bóias de boreste/bombordo, faróis luminosos, rochedos e baixios).
- Gerenciador de downloads locais em `CacheStorage` para navegação em alto-mar sem conexão celular.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- **Node.js** v18+ ou v20+
- **npm** v9+

```bash
# 1. Clone o repositório
git clone https://github.com/SEU_USUARIO/mare-segura.git
cd mare-segura

# 2. Instale as dependências
npm install --legacy-peer-deps

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse no navegador: `http://localhost:3000`

---

## 🌐 Publicação no GitHub Pages

O repositório já inclui a automação pronta para publicação contínua em `.github/workflows/deploy.yml`.

### Como Ativar:
1. No repositório no GitHub, acesse **Settings** > **Pages**.
2. Em **Build and deployment** > **Source**, selecione:
   - **GitHub Actions**
3. Faça qualquer `git push` para o branch `main` (ou execute manualmente em **Actions** > **Deploy to GitHub Pages** > **Run workflow**).
4. O site estará online no endereço: `https://<seu-usuario>.github.io/<nome-do-repositorio>/`

---

## 🛠️ Correção Preventiva do GitHub Actions (setup-node lock file)

### O Problema Conhecido:
Ao usar `actions/setup-node@v4` com a diretiva `cache: 'npm'`, o GitHub Actions busca obrigatoriamente por `package-lock.json`, `npm-shrinkwrap.json` ou `yarn.lock`. Se o arquivo de lock não estiver commitado ou se o projeto tiver usado outro gerenciador (ex: bun), o workflow falha com:
```
Error: Dependencies lock file is not found in /home/runner/work/... Supported file patterns: package-lock.json,npm-shrinkwrap.json,yarn.lock
```

### A Solução Aplicada no Projeto:
1. **Remoção da restrição de cache rígido**: No `.github/workflows/deploy.yml`, o `actions/setup-node@v4` foi configurado sem forçar o `cache: 'npm'`, evitando a interrupção caso haja discrepância de lockfile.
2. **Arquivo `.npmrc` com `legacy-peer-deps=true`**: Garante que o `npm install` no runner do GitHub resolva todas as dependências sem erros de pares (`ERESOLVE`).
3. **`package-lock.json` gerado e padronizado**: Incluído na raiz do projeto para compatibilidade universal.
4. **`base: './'` no `vite.config.ts`**: Garante que os caminhos dos assets gerados funcionem tanto na raiz quanto em subdiretórios de repositório do GitHub Pages.

---

## 📦 Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor local com hot-reload na porta 3000 |
| `npm run build` | Compila o bundle de produção otimizado na pasta `dist/` |
| `npm run preview` | Visualiza o build de produção localmente |
| `npm run lint` | Validação de tipos TypeScript |

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para mais informações.
