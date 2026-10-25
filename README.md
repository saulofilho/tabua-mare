# ⚓ MaréSegura — Tábua de Marés & Navegação Náutica Offline

> Sistema tático de previsão de marés astronômicas em tempo real, telemetria oceanográfica sem dados fictícios (*zero mock*), monitoramento de folga sob a quilha (UKC), alertas sonoros marítimos e cartas náuticas com operação 100% offline.

---

## 🧭 Visão Geral & Arquitetura de Performance

O **MaréSegura** foi projetado para velejadores, marinheiros, pescadores e navegadores costeiros com base na filosofia **Tactical Maritime**:
- **Abertura Ultrarrápida**: Ao carregar o aplicativo, é renderizada **apenas a Tábua de Marés principal** com curva em canvas 2D leve. Componentes computacionalmente pesados (gráficos comparativos de 24h/7d em Recharts, simulação 3D Three.js e rosa dos ventos vetorial) só são carregados sob demanda quando o usuário acessa as respectivas seções.
- **Grid Tático de Funcionalidades**: Na página inicial, logo abaixo da tábua do dia, um grid com 8 cards táticos direciona para cada módulo especializado com navegação imediata e botão de retorno rápido.
- **Menu Seletor Resiliente a Fullscreen**: Substituiu abas estáticas por um seletor suspenso categorizado (`NAVEGAÇÃO`, `INSTRUMENTOS`, `SISTEMA`), garantindo que o layout nunca quebre em telas cheias, monitores ultrawide ou displays de ponte de comando.
- **Zero Mock (100% Dados Reais)**: Sem dados estáticos simulados. Harmônicos astronômicos calibrados pela **Diretoria de Hidrografia e Navegação (DHN/Marinha do Brasil)** combinados com telemetria ao vivo da **Open-Meteo Marine API** (modelos NOAA WaveWatch III e ECMWF).

---

## ✨ Módulos e Funcionalidades

### 1. 📊 Tábua de Marés Principal & Curva Interativa
- **Preia-mar e Baixa-mar Astronômicas**: Horários e alturas exatas calculados com os constituintes harmônicos $M_2, S_2, N_2, K_1, O_1, M_4$ em relação ao **Zero Hidrográfico (ZH)**.
- **Radar de Praia Mais Próxima**: Identifica coordenadas por GPS (`navigator.geolocation`) e calcula via fórmula geodésica de Haversine a estação litorânea mais próxima com conversão em $km$ e Milhas Náuticas ($MN$).
- **Curva Suave Contínua**: Renderizada em HTML5 Canvas nativo de alta performance para baixo consumo de bateria em celulares e tablets náuticos.
- **Histórico Comparativo (Módulo Dedicado)**: Visualização separada com histórico das últimas 24h (Real vs. Astronômico), retrospectiva dos últimos 7 dias e estatísticas semanais.

### 2. 🌊 Previsão de Ondas, Vento & Rosa dos Ventos
- **Condições Oceânicas Reais**:
  - Altura significativa de onda e ondulação (*swell*) em metros.
  - Período de onda em segundos ($s$).
  - Direção angular das ondas em graus ($^\circ$).
  - Velocidade do vento costeiro em nós ($kt$) e $km/h$, com rajadas e classificação na escala Beaufort.
- **Rosa dos Ventos Tática (16 Pontos)**: Bússola vetorial interativa indicando os rumos cardeais, colaterais e subcolaterais com vetores de vento e ondulação.

### 3. 🗺️ Carta Náutica & Radar GNSS
- **Camadas Cartográficas OpenSeaMap**:
  - Auxílios à navegação: faróis, balizas, bóias laterais (boreste/bombordo), perigos isolados, cabos submarinos e profundidades batimétricas.
- **Rastreamento de Posição em Tempo Real**: Coordenadas em graus e minutos decimais náuticos, rumo sobre o fundo (COG) e velocidade sobre o fundo (SOG).
- **Modo Noturno Náutico**: Alternância de paleta de alto contraste para não comprometer a visão noturna da tripulação no passadiço.

### 4. 🚨 Central de Alertas & Toques Náuticos
- **Regras Configuráveis de Segurança**:
  - Limiar de Baixa-mar crítica (risco de encalhe).
  - Alerta de Preia-mar máxima (cais e marinas inundáveis).
  - Folga mínima sob a quilha violada.
  - Alerta de Maré de Sizígia (Lua Nova / Lua Cheia com maior amplitude).
- **Sintetizador Web Audio API com Múltiplos Toques Náuticos**:
  - 🚨 **Sirene Náutica**: Modulação de frequência de emergência militar/costeira.
  - 🔔 **Sino de Navio / Bordo**: Ressonância acústica de bronze tradicional.
  - 📯 **Buzina de Nevoeiro (Foghorn)**: Tom grave de baixa frequência (110 Hz) com harmônicos para longo alcance.
  - 📡 **Sonar Náutico**: Pulso acústico clássico de varredura submarina.
  - Permite atribuir um toque específico para cada regra configurada e testar o áudio no painel.

### 5. 📐 Calculadora de Folga sob a Quilha (UKC - Under-Keel Clearance)
- **Cálculo da Profundidade Real Efetiva**:
  $$\text{Profundidade Real} = \text{Sondagem da Carta (Datum ZH)} + \text{Altura da Maré Atual}$$
- **Folga sob a Quilha**:
  $$\text{UKC} = \text{Profundidade Real} - \text{Calado Máximo da Embarcação}$$
- Alerta visual instantâneo caso a margem de segurança configurada do barco seja violada.

### 6. 📖 Diário de Navegação (Logbook) & Conversor Náutico
- **Livro de Bordo Digital**: Registro de singraduras, waypoints, condições meteorológicas, nível de combustível, motorização e anotações do comandante. Armazenamento local permanente (`localStorage`).
- **Conversor Náutico Integrado**:
  - Milhas Náuticas ($MN$) $\leftrightarrow$ Quilômetros ($km$) $\leftrightarrow$ Metros ($m$)
  - Nós ($kt$) $\leftrightarrow$ Quilômetros por hora ($km/h$) $\leftrightarrow$ Metros por segundo ($m/s$)
  - Pés ($ft$) $\leftrightarrow$ Metros ($m$) $\leftrightarrow$ Braças ($fathoms$)
  - Celsius ($^\circ C$) $\leftrightarrow$ Fahrenheit ($^\circ F$)

### 7. 💾 Gerenciador de Cartas Offline & PWA
- Armazenamento em cache de cartas náuticas para áreas de navegação costeira sem cobertura de sinal 4G/5G celular.
- Instalação como Web App (PWA) nativo com manifesto e service worker.

---

## 🚀 Publicação na Vercel (Recomendado)

O projeto já inclui o arquivo de configuração `/vercel.json` pré-configurado com regras de reescrita SPA (`Single Page Application`) e controle de cache para assets e Service Worker.

### ❓ Precisa cadastrar Variáveis de Ambiente (ENVs) na Vercel?
**NÃO!** O MaréSegura opera completamente sem necessidade de cadastrar chaves secretas ou variáveis de ambiente para funcionar:
- Os cálculos astronômicos de maré são executados localmente no navegador via harmônicos da Marinha (DHN).
- A telemetria marinha utiliza a API pública e aberta da **Open-Meteo**, sem necessidade de tokens.
- O sistema de áudio roda direto na **Web Audio API** do navegador.
- Os mapas utilizam os tiles abertos da OpenStreetMap e OpenSeaMap.

*(Opcional: Apenas caso deseje integrar seu próprio Google Analytics, pode cadastrar `VITE_GA_MEASUREMENT_ID` nas variáveis de ambiente da Vercel).*

### Passo a Passo para Deploy na Vercel:
1. Faça push do código para o seu repositório no **GitHub** ou **GitLab**.
2. Acesse [vercel.com](https://vercel.com) e clique em **Add New...** > **Project**.
3. Importe o repositório do **MaréSegura**.
4. A Vercel detectará automaticamente o framework como **Vite**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Clique em **Deploy**. O aplicativo estará online em menos de 1 minuto!

---

## 💰 Como Adicionar e Monetizar com Google Ads (Google AdSense)

O aplicativo **já está 100% preparado** para veicular anúncios e ser aprovado no programa **Google AdSense**.

### 1. Requisitos para Aprovação no Google AdSense
Para faturar com anúncios no Google, o AdSense analisa o site e exige:
- **Domínio Próprio Registrado**: (Ex: `maresegura.com.br`, `tábuademares.com`, etc.). Subdomínios compartilhados (como `.vercel.app` ou `.github.io`) costumam ser rejeitados ou demorar meses; um domínio registrado no [Registro.br](https://registro.br) ou Namecheap aumenta a taxa de aprovação para quase 100%.
- **Política de Privacidade & Termos**: Obrigatório por lei (LGPD/GDPR) e exigência expressa do AdSense para declarar cookies de publicidade. **Já incluído nativamente no app!** O link fica no rodapé e no menu de ferramentas com modal pronto e completo.
- **Conteúdo Útil e Original**: O MaréSegura atende com louvor este requisito, oferecendo tábuas astronômicas, telemetria oceanográfica e utilitários de navegação.

### 2. Passo a Passo para Ativar os Anúncios:
1. Acesse [google.com/adsense](https://adsense.google.com/) e cadastre sua conta.
2. Adicione o seu domínio em **Sites** > **Adicionar site**.
3. Obtenha seu **ID de Publicador (Client ID)** (começa com `ca-pub-...`).
4. Crie um **Bloco de Anúncios Responsivo** em **Anúncios** > **Por bloco de anúncios** e copie o **Slot ID**.
5. No painel da **Vercel** (em *Settings* > *Environment Variables*) ou no seu arquivo `.env.local`, adicione:
   ```env
   VITE_GOOGLE_ADSENSE_CLIENT_ID="ca-pub-SEU_NUMERO_AQUI"
   VITE_GOOGLE_ADSENSE_SLOT_ID="SEU_SLOT_ID_AQUI"
   ```
6. O componente `<AdSenseBanner />` cuidará da injeção assíncrona do script oficial do Google, redimensionamento responsivo e tratamento à prova de falhas caso o usuário utilize adblocker.

---

## 🌐 Publicação no GitHub Pages

O repositório também conta com pipeline CI/CD pronta em `.github/workflows/deploy.yml`.

### Como Ativar:
1. No repositório no GitHub, vá em **Settings** > **Pages**.
2. Em **Build and deployment** > **Source**, selecione **GitHub Actions**.
3. Realize um `git push` para a branch `main`.
4. O GitHub Actions fará o build e publicação automaticamente.

---

## 💻 Como Executar Localmente

### Pré-requisitos
- **Node.js**: v18.x ou v20.x+
- **npm**: v9.x+

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

## 📦 Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor local na porta 3000 com recarregamento rápido |
| `npm run build` | Compila o bundle de produção estático ultra-otimizado na pasta `dist/` |
| `npm run preview` | Executa um servidor local servindo os arquivos compilados da pasta `dist/` |
| `npm run lint` | Executa a verificação estrita de tipos com `tsc --noEmit` |
| `npm run test` | Executa a suíte de testes unitários com Vitest (validação de harmônicos e marés) |

---

## 🛡️ Políticas de Segurança & Privacidade
- O aplicativo não coleta dados de telemetria sem consentimento.
- As posições de GPS são utilizadas exclusivamente na memória do navegador para cálculo de proximidade e navegação no radar.
- O diário de bordo e as regras de alerta ficam salvos estritamente no armazenamento local do navegador do comandante (`localStorage`).

---

## 📄 Licença
Distribuído sob a licença MIT. Consulte `LICENSE` para mais detalhes.
