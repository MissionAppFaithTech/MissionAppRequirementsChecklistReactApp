# 📋 Mission App - Especificação de Requisitos

Este repositório centraliza a documentação de especificação de requisitos funcionais e não funcionais para o **Mission App**, uma plataforma dedicada a conscientizar igrejas e apoiar o trabalho missionário ao redor do mundo.

O documento principal está disponível no site publicado em [Mission App Requirements List](https://missionappfaithtech.github.io/MissionAppRequirementsList/), que inclui o detalhamento completo de cada requisito, fluxos de uso e mockups visuais integrados (localizados na pasta `img/`).

---

## 🔗 Links Úteis do Projeto

*   **Repositório no GitHub:** [MissionAppFaithTech](https://github.com/MissionAppFaithTech)
*   **Design no Figma:** [Telas e Componentes](https://www.figma.com/design/uMAwJPYKaEoN7ScjAmgZ6O/Mission-app?node-id=902-4740&t=mX8OgGJCVgXsPr0h-0)
*   **Futuras Funcionalidades do MissionApp:** [Documento com futuros passos e funcionalidades](https://docs.google.com/document/d/1xejaufVDE1g66fMUhLj_naYY2KtVON6-CCy_s6yEc1Y/edit?tab=t.0#heading=h.c22xkczclznq)

---

## 🛠️ Como Visualizar a Especificação

Para ler o documento completo com todos os detalhes e imagens integradas:
1. Acesse o site publicado em [Mission App Requirements List](https://missionappfaithtech.github.io/MissionAppRequirementsList/) em qualquer navegador web moderno.
2. Utilize o **sumário lateral**, a **busca de requisitos** ou o botão **"Voltar ao topo"** para navegar rapidamente pelas seções.

---

## 🧭 Estrutura do Projeto

```text
MissionAppRequirementsList/
|-- index.html
|-- css/
|   |-- base.css
|   |-- layout.css
|   |-- sidebar.css
|   |-- content.css
|   |-- components.css
|   `-- responsive.css
|-- js/
|   |-- main.js
|   |-- navigation.js
|   |-- search.js
|   `-- scroll-spy.js
|-- img/
|-- README.md
`-- .github/workflows/pages.yml
```

O `index.html` concentra o conteúdo da especificação. Os estilos e comportamentos foram separados por responsabilidade para facilitar manutenção, responsividade e evolução da navegação.

---

## 📊 Cópia do Sumário de Requisitos

Abaixo está a cópia consolidada do sumário apresentado no documento de requisitos.

### 📌 Requisitos Funcionais (RF)

1.  **Autenticação e Acesso** (Login, redefinição de senha, aprovação de cadastro de missionário e regras de acesso).
2.  **Cadastro de Apoiador** (Autocadastro e vinculação opcional a uma comunidade de fé).
3.  **Cadastro de Missionário** (Solicitação de cadastro com dados ministeriais).
4.  **Papéis e Privilégios do Missionário** (Visualização e edição do próprio perfil, projetos e postagens).
5.  **Papéis e Privilégios do Apoiador** (Seguir missionários, curtir postagens e visualizar projetos/doações).
6.  **Barra de Navegação (NavBar)** (Menu de navegação e busca rápida global).
7.  **Busca e Filtragem** (Pesquisa de missionários e projetos por nome, localização ou tag).
8.  **Postagens** (Criação, edição e exclusão de posts com texto, imagens e vídeos).
9.  **Projetos de Impacto** (Criação e gerenciamento de projetos com metas e status).
10. **Perfil do Missionário** (Visão pública do perfil ministerial e cabeçalho editável).
11. **Perfil do Apoiador** (Visão do perfil com projetos seguidos e postagens favoritadas).
12. **Área de Doações** (Configuração de meios de doação pelo missionário e fluxos de contribuição externa).
13. **Campanhas de Divulgação** (Cadastro e exibição de banners/selos de campanhas ativas).
14. **Seção (ou Aba) de Projetos de Impacto** (Aba de descoberta de novos projetos recomendados ou aleatórios).
15. **Configurações de Conta** (Atualização de dados cadastrais, e-mail, senha e dados eclesiásticos).
16. **Sistema de Denúncias** (Fluxo de denúncias de posts, projetos ou perfis impróprios).
17. **Administração do Sistema** (Gerenciamento global de aprovações, denúncias e categorias).
18. **Painel Administrativo** (Dashboard com relatórios, métricas de crescimento e engajamento).

### 🔒 Requisitos Não Funcionais (RNF)

*   **1. Segurança (NF 1)**
    *   1.1 Criptografia de Dados Sensíveis
    *   1.2 Conformidade com a LGPD
    *   1.3 Proteção contra Ataques de Força Bruta
    *   1.4 Comunicação Segura (HTTPS)
*   **2. Desempenho (NF 2)**
    *   2.1 Otimização de Imagens
    *   2.2 Tempo de Carregamento
    *   2.3 Paginação e Lazy Loading
    *   2.4 Caching de Alto Volume
    *   2.5 Escalabilidade
*   **3. Usabilidade (NF 3)**
    *   3.1 Feedback Visual do Sistema
*   **4. Manutenibilidade (NF 4)**
    *   4.1 Arquitetura Evolutiva
    *   4.2 Documentação da API
    *   4.3 Monitoramento de Erros
    *   4.4 Alertas de Erro
    *   4.5 Traçabilidade – LGPD
*   **5. Confiabilidade (NF 5)**
    *   5.1 Disponibilidade – Uptime
    *   5.2 Integridade Transacional – Atomicidade
    *   5.3 Integridade de E-mails
*   **6. Portabilidade (NF 6)**
    *   6.1 Responsividade Móvel
