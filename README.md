# Radar de Leads Locais — PWA

Aplicativo web instalável (PWA) para Android, com busca por CEP, categoria e raio, lista de empresas, filtros e exportação CSV compatível com Excel.

## O que está incluído

- Consulta de CEP pela BrasilAPI.
- Busca de empresas no OpenStreetMap via Overpass API.
- Distância aproximada em linha reta a partir das coordenadas do CEP.
- Campos de telefone/WhatsApp, e-mail, site e endereço quando estiverem cadastrados na fonte.
- Filtros por nome e disponibilidade de contato.
- Exportação CSV com separador `;`, codificação UTF-8 e BOM para facilitar abertura no Excel.
- PWA com manifesto, ícones e cache básico para abrir a interface offline.
- Layout responsivo para celular e computador.

## Importante: cobertura e limitações

Este app consulta dados colaborativos do OpenStreetMap; **não é uma base comercial completa** e não garante encontrar todas as empresas da área. E-mail, WhatsApp, telefone, site e endereço podem estar ausentes ou desatualizados. Os contatos só aparecem quando cadastrados publicamente na fonte. Distância é calculada em linha reta, não por trajeto de carro.

As APIs públicas podem impor limites, ficar temporariamente indisponíveis ou mudar suas políticas. Para uso comercial frequente ou em grande escala, avalie um provedor de dados com licença e SLA adequados, respeite os termos de uso e implemente cache/limites de requisição. Evite enviar mensagens em massa não solicitadas e observe a LGPD.

## Como testar no computador

1. Descompacte o ZIP.
2. Abra um terminal na pasta `radar-leads-pwa`.
3. Execute:
   ```bash
   python -m http.server 8000
   ```
4. No mesmo computador, abra `http://localhost:8000`.

Abrir o `index.html` diretamente pelo gerenciador de arquivos pode impedir o service worker e a instalação. Use um servidor local.

## Como publicar gratuitamente para instalar no Android

O PWA precisa ser servido por HTTPS (ou localhost para teste). Uma opção é GitHub Pages:

1. Crie ou entre em uma conta no GitHub.
2. Crie um repositório público, por exemplo `radar-leads-pwa`.
3. Envie todos os arquivos e pastas deste ZIP para a raiz do repositório. Não envie apenas o ZIP: envie o conteúdo descompactado.
4. No repositório, abra **Settings → Pages**.
5. Em **Build and deployment**, escolha **Deploy from a branch**, selecione a branch `main` e a pasta `/ (root)`, e salve.
6. Aguarde a publicação e abra o endereço HTTPS indicado pelo GitHub Pages.
7. No Android, abra esse endereço no Chrome.
8. Toque no menu ⋮ e escolha **Instalar app** ou **Adicionar à tela inicial** (o nome varia por versão/navegador).
9. Confirme. O ícone Radar de Leads aparecerá na tela inicial.

A publicação pode levar alguns minutos. Se atualizar os arquivos, pode ser necessário recarregar a página; a versão do cache pode ser atualizada em `sw.js`.

## Estrutura

- `index.html` — tela principal
- `styles.css` — visual responsivo
- `app.js` — CEP, busca, filtros, distâncias e CSV
- `manifest.webmanifest` — configuração PWA
- `sw.js` — cache/service worker
- `icons/` — ícones do app

## Privacidade

O CEP é enviado à BrasilAPI para consulta de endereço; a consulta de empresas é enviada ao serviço público Overpass/OpenStreetMap. Não há servidor próprio, conta de usuário nem banco de dados neste protótipo. Os resultados ficam na memória da página e não são salvos em uma conta.
