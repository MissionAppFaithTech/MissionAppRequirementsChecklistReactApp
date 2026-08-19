export type RequirementKind = 'functional' | 'non-functional';

export type RequirementNode = {
  id: string;
  code: string;
  title: string;
  description?: string;
  children?: RequirementNode[];
};

const item = (id: string, code: string, title: string, description?: string, children?: RequirementNode[]): RequirementNode => ({
  id, code, title, description, children,
});

export const functionalRequirements: RequirementNode[] = [
  item('rf-1', 'RF 1', 'Autenticação e Acesso', 'Entrada segura para apoiadores, missionários e administradores.', [
    item('rf-1-1', 'RF 1.1', 'Login', 'Acesso por e-mail e senha previamente cadastrados.'),
    item('rf-1-2', 'RF 1.2', 'Redefinição de senha', 'Fluxo seguro de recuperação por e-mail.'),
    item('rf-1-3', 'RF 1.3', 'Aprovação de cadastro', 'Administrador aprova manualmente solicitações de missionários.'),
    item('rf-1-4', 'RF 1.4', 'Acesso sem autenticação em rotas públicas', 'Visitantes acessam perfis, doações, projetos e pesquisas apenas em modo de leitura.', [
      item('rf-1-4-1', 'RF 1.4.1', 'Fluxo de visitantes e alertas', 'Exibe convite para cadastro e alerta ao tentar uma ação protegida.'),
    ]),
    item('rf-1-5', 'RF 1.5', 'Acesso com autenticação', 'Usuários autenticados acessam as rotas com seus privilégios completos.'),
  ]),
  item('rf-2', 'RF 2', 'Cadastro de Apoiador', 'Auto-cadastro, vínculo opcional com comunidade de fé e gerenciamento de perfil.', [
    item('rf-2-1', 'RF 2.1', 'Cadastro de apoiador', 'Solicita dados pessoais, contato e comunidade de fé opcional.', [
      item('rf-2-1-faith', 'RF 2.1.a', 'Busca de comunidade de fé', 'Seletor com busca e sugestões em tempo real.'),
      item('rf-2-1-new-faith', 'RF 2.1.b', 'Adicionar nova comunidade de fé', 'Modal com nome, localização, pastor e contatos; campos obrigatórios validam antes de salvar.'),
      item('rf-2-1-persist', 'RF 2.1.c', 'Persistência e seleção automática', 'Nova comunidade fica disponível para outros usuários e é selecionada no cadastro em andamento.'),
    ]),
    item('rf-2-3', 'RF 2.3', 'Gerenciamento de perfil do apoiador', 'Visualiza e edita nome, minibiografia e comunidade.', [
      item('rf-2-3-photo', 'RF 2.3.a', 'Foto de perfil otimizada', 'Upload com compressão automática.'),
      item('rf-2-3-username', 'RF 2.3.b', 'Nome de usuário único', 'Valida unicidade em toda a plataforma.'),
    ]),
  ]),
  item('rf-3', 'RF 3', 'Cadastro de Missionário', 'Cadastro completo, verificação de e-mail e aprovação administrativa.', [
    item('rf-3-1', 'RF 3.1', 'Cadastrar missionário', 'Reúne dados pessoais, eclesiásticos e da atuação missionária.', [
      item('rf-3-1-data', 'RF 3.1.1', 'Informações necessárias', 'E-mail, telefones, identidade, bio, comunidade, pastor e agência missionária.'),
      item('rf-3-1-agency', 'RF 3.1.2', 'Agências missionárias', 'Busca, seleção e criação de agência em fluxo equivalente ao da comunidade de fé.', [
        item('rf-3-1-agency-modal', 'RF 3.1.2.a', 'Modal de cadastro da agência', 'Nome, país, estado, cidade e telefone obrigatório, além de dados opcionais.'),
      ]),
      item('rf-3-1-profile', 'RF 3.1.3', 'Gerenciamento de perfil do missionário', 'Edição de dados, foto otimizada e validação de nome de usuário.'),
    ]),
    item('rf-3-2', 'RF 3.2', 'E-mail de verificação do missionário', 'Verificação em até sete dias; cadastros não confirmados são removidos.'),
    item('rf-3-3', 'RF 3.3', 'E-mail de alerta para o administrador', 'Notifica o administrador após a confirmação do e-mail.'),
    item('rf-3-4', 'RF 3.4', 'Aprovação do administrador', 'Aprovação realizada pelo painel de gerenciamento de missionários.'),
    item('rf-3-5', 'RF 3.5', 'Primeiro login do missionário', 'Completa informações importantes da bio no primeiro acesso.'),
  ]),
  item('rf-4', 'RF 4', 'Papéis e Privilégios do Missionário', 'Permissões para identidade, projetos, doações, conexões e descoberta.', [
    item('rf-4-1', 'RF 4.1', 'Identidade e perfil', 'Página dedicada para gerenciar a apresentação.', [
      item('rf-4-1-1', 'RF 4.1.1', 'Edição de cabeçalho', 'Personaliza avatar, nome e minibiografia.'),
      item('rf-4-1-2', 'RF 4.1.2', 'Edição de conta', 'Atualiza e-mail, senha, comunidade de fé e pastor.'),
    ]),
    item('rf-4-2', 'RF 4.2', 'Projetos e conteúdo', 'Gerencia a vitrine de sua causa e comunica atualizações.', [
      item('rf-4-2-1', 'RF 4.2.1', 'Projetos de impacto', 'Cria, edita e exclui seus projetos.'),
      item('rf-4-2-2', 'RF 4.2.2', 'Criação de postagens', 'Publica imagem e legenda para seguidores.'),
    ]),
    item('rf-4-3', 'RF 4.3', 'Configuração financeira', 'Define como deseja receber recursos.', [
      item('rf-4-3-1', 'RF 4.3.1', 'Área de doações', 'Acessa a configuração de recebimentos.'),
      item('rf-4-3-2', 'RF 4.3.2', 'Métodos de recebimento', 'Cadastra chaves Pix e dados de transferência.'),
    ]),
    item('rf-4-4', 'RF 4.4', 'Interação social e conteúdo', 'Segue ministérios e acompanha timelines.', [
      item('rf-4-4-1', 'RF 4.4.1', 'Rede de conexões', 'Segue outros missionários.'),
      item('rf-4-4-2', 'RF 4.4.2', 'Feeds pessoal e de conexões', 'Visualiza suas postagens e as de quem segue.'),
    ]),
    item('rf-4-5', 'RF 4.5', 'Busca e descoberta', 'Localiza pessoas e projetos na plataforma.', [
      item('rf-4-5-1', 'RF 4.5.1', 'Pesquisa global', 'Pesquisa apoiadores, missionários e projetos.'),
      item('rf-4-5-2', 'RF 4.5.2', 'Exploração', 'Acessa a aba de Projetos de Impacto.'),
    ]),
  ]),
  item('rf-5', 'RF 5', 'Papéis e Privilégios do Apoiador', 'Perfil, feed, descoberta e relacionamento com missionários.', [
    item('rf-5-1', 'RF 5.1', 'Perfil e conta do apoiador', 'Gerencia dados pessoais e credenciais.', [
      item('rf-5-1-1', 'RF 5.1.1', 'Edição de cabeçalho', 'Personaliza foto e informações públicas.'),
      item('rf-5-1-2', 'RF 5.1.2', 'Área de conta pessoal', 'Gerencia e-mail, senha e dados eclesiásticos.'),
    ]),
    item('rf-5-2', 'RF 5.2', 'Interação social do apoiador', 'Relacionamento focado em seguir missionários.', [
      item('rf-5-2-1', 'RF 5.2.1', 'Regra de conexão', 'Pode seguir perfis de missionários.'),
      item('rf-5-2-2', 'RF 5.2.2', 'Restrição', 'Não pode seguir outros apoiadores.'),
    ]),
    item('rf-5-3', 'RF 5.3', 'Feed do apoiador', 'Agrega cronologicamente publicações dos missionários seguidos.', [
      item('rf-5-3-1', 'RF 5.3.1', 'Aba Feed', 'Exibe atualizações da rede de conexões.'),
    ]),
    item('rf-5-4', 'RF 5.4', 'Descoberta e recomendação', 'Apresenta novas causas e buscas.', [
      item('rf-5-4-1', 'RF 5.4.1', 'Aba Projetos de Impacto', 'Recomenda projetos e campanhas.'),
      item('rf-5-4-2', 'RF 5.4.2', 'Pesquisa', 'Busca missionários e projetos específicos.'),
    ]),
    item('rf-5-5', 'RF 5.5', 'Interação e doação', 'Visita perfis e realiza contribuições externas.', [
      item('rf-5-5-1', 'RF 5.5.1', 'Visualização de perfis', 'Vê bio, contato, projetos, campanhas e postagens.'),
      item('rf-5-5-2', 'RF 5.5.2', 'Realização de doações', 'Acessa Pix ou transferência pelo perfil.'),
    ]),
  ]),
  item('rf-6', 'RF 6', 'Barra de Navegação', 'NavBar adaptável, disponível em todas as páginas.', [
    item('rf-6-1', 'RF 6.1', 'Estrutura geral', 'Acesso rápido às funcionalidades essenciais.'),
    item('rf-6-2', 'RF 6.2', 'Itens para usuário autenticado', 'Home, pesquisar, projetos, conta e sair.', [
      item('rf-6-2-1', 'RF 6.2.1', 'Home', 'Redireciona para o feed principal.'),
      item('rf-6-2-2', 'RF 6.2.2', 'Pesquisar', 'Acessa busca de missionários e projetos.'),
      item('rf-6-2-3', 'RF 6.2.3', 'Projetos', 'Abre a exploração de novos projetos.'),
      item('rf-6-2-4', 'RF 6.2.4', 'Conta', 'Abre configurações de conta.'),
      item('rf-6-2-5', 'RF 6.2.5', 'Sair', 'Encerra a sessão.'),
    ]),
    item('rf-6-3', 'RF 6.3', 'Comportamento do visitante', 'Exibe logo e ações de cadastro ou login.'),
  ]),
  item('rf-7', 'RF 7', 'Busca e Filtragem', 'Pesquisa global com resultados acionáveis.', [
    item('rf-7-1', 'RF 7.1', 'Acesso à busca', 'Ícone ou campo explícito no cabeçalho.'),
    item('rf-7-2', 'RF 7.2', 'Critérios de filtragem', 'Nome de usuário, título de projeto e campanha.'),
    item('rf-7-3', 'RF 7.3', 'Exibição de resultados', 'Lista ou grade com foto, nome e destino clicável.'),
  ]),
  item('rf-8', 'RF 8', 'Postagens', 'Publicações, likes e preparação para comentários.', [
    item('rf-8-1', 'RF 8.1', 'Criação de postagens', 'Apenas missionários criam legenda, até três imagens e links opcionais.', [
      item('rf-8-1-caption', 'RF 8.1.a', 'Legenda obrigatória', 'Toda postagem precisa de legenda.'),
      item('rf-8-1-images', 'RF 8.1.b', 'Limite global de imagens', 'Cada imagem incrementa contador limitado a 50.'),
    ]),
    item('rf-8-2', 'RF 8.2', 'Gerenciamento de postagens', 'Missionário exclui posts e arquivos associados; limite de imagens pede confirmação para substituir a mais antiga.'),
    item('rf-8-3', 'RF 8.3', 'Comentários', 'Não haverá comentários inicialmente, mas a arquitetura deve estar preparada.'),
    item('rf-8-4', 'RF 8.4', 'Likes', 'Qualquer usuário pode gostar e remover seu like.'),
    item('rf-8-5', 'RF 8.5', 'Segurança nas postagens', 'Menu de opções abre o fluxo de denúncia do RF 16.'),
  ]),
  item('rf-9', 'RF 9', 'Projetos de Impacto', 'Vitrine principal da causa de cada missionário.', [
    item('rf-9-1', 'RF 9.1', 'Cadastro de projeto', 'Somente missionário adiciona projeto ao próprio perfil.'),
    item('rf-9-2', 'RF 9.2', 'Estrutura do projeto', 'Título, vídeo opcional, descrição, capa obrigatória e dados de campanha.', [
      item('rf-9-2-cover', 'RF 9.2.a', 'Imagem de capa', 'Upload obrigatório de imagem representativa.'),
      item('rf-9-2-campaign', 'RF 9.2.b', 'Selo e título de campanha', 'Exibidos quando houver associação.'),
    ]),
    item('rf-9-3', 'RF 9.3', 'Visualização e denúncia', 'Imagem com zoom, vídeo, descrição e menu para denunciar.'),
    item('rf-9-4', 'RF 9.4', 'Edição e exclusão', 'Altera qualquer dado ou exclui com confirmação explícita.'),
  ]),
  item('rf-10', 'RF 10', 'Perfil do Missionário', 'Identidade pública, abas de conteúdo e gestão de seguidores.', [
    item('rf-10-1', 'RF 10.1', 'Identidade no cabeçalho', 'Avatar, nome, role, usuário, agência, selo e minibiografia.'),
    item('rf-10-2', 'RF 10.2', 'Dono versus visitante', 'Ações mudam conforme quem visualiza o perfil.'),
    item('rf-10-3', 'RF 10.3', 'Botões de ação', 'Link, contato, doações, seguir, editar, menu e denunciar.'),
    item('rf-10-4', 'RF 10.4', 'Navegação interna por abas', 'Sobre, Projeto, Campanha e Postagens, com aba ativa destacada.'),
    item('rf-10-5', 'RF 10.5', 'Edição do cabeçalho e perfil', 'Formulário com foto, nome, usuário, bio e contato; cancelar ou submeter.'),
    item('rf-10-6', 'RF 10.6', 'Seguidores', 'Contador, cards clicáveis e paginação ou carregar mais.'),
    item('rf-10-7', 'RF 10.7', 'Aba Sobre', 'Bio, história, locais, agência, comunidade, pedidos e versículo; campos editáveis.'),
  ]),
  item('rf-11', 'RF 11', 'Perfil do Apoiador', 'Perfil público com feed, exploração e edição.', [
    item('rf-11-1', 'RF 11.1', 'Identidade no cabeçalho', 'Avatar, nome, role, usuário, minibiografia e comunidade.'),
    item('rf-11-2', 'RF 11.2', 'Dono versus visitante', 'Dono vê seguindo e editar; visitante vê apenas o menu de denúncia.'),
    item('rf-11-3', 'RF 11.3', 'Botões de ação', 'Editar, seguindo e denúncia.'),
    item('rf-11-4', 'RF 11.4', 'Navegação por abas', 'Feed e Explorar, com aba ativa destacada.'),
    item('rf-11-5', 'RF 11.5', 'Edição do perfil', 'Foto, nome, usuário e minibiografia; cancelar ou submeter.'),
    item('rf-11-6', 'RF 11.6', 'Seguindo', 'Lista paginada de missionários acompanhados.'),
  ]),
  item('rf-12', 'RF 12', 'Área de Doações', 'Configuração de Pix e transferência, sempre processados fora do aplicativo.', [
    item('rf-12-1', 'RF 12.1', 'Visão do missionário', 'Configura recebimentos e mensagem aos apoiadores.', [
      item('rf-12-1-1', 'RF 12.1.1', 'Mensagem aos apoiadores', 'Edita apelo ou agradecimento exibido no topo.'),
      item('rf-12-1-2', 'RF 12.1.2', 'Métodos disponíveis', 'Pix simples ou transferência bancária, com campos e cópia de dados.'),
      item('rf-12-1-4', 'RF 12.1.4', 'Status da configuração', 'Indica método Ativo ou Pendente.'),
    ]),
    item('rf-12-2', 'RF 12.2', 'Visão do apoiador', 'Exibe mensagem e método configurado; pagamento ocorre fora do app.'),
    item('rf-12-3', 'RF 12.3', 'Segurança e processamento', 'Não armazena cartões nem participa do processamento financeiro.'),
  ]),
  item('rf-13', 'RF 13', 'Campanhas de Divulgação', 'Campanhas administradas para promover projetos associados.', [
    item('rf-13-1', 'RF 13.1', 'Cadastro de campanhas', 'Título, subtítulo, descrição, banners, selo, imagens, links e datas.'),
    item('rf-13-2', 'RF 13.2', 'Associação de projetos', 'Uma campanha pode ter vários projetos; um projeto pode estar em várias campanhas.'),
    item('rf-13-3', 'RF 13.3', 'Página da campanha', 'Página própria com conteúdo, imagens, links e botão para projetos.'),
    item('rf-13-4', 'RF 13.4', 'Exploração de projetos', 'Campanha no topo da exploração e projetos associados abaixo.', [
      item('rf-13-4-1', 'RF 13.4.1', 'Exibição da campanha', 'Carrossel, selo, datas, detalhes e ações.'),
      item('rf-13-4-2', 'RF 13.4.2', 'Projetos vinculados', 'Cards exibem selo e título da campanha.'),
      item('rf-13-4-3', 'RF 13.4.3', 'Descoberta de campanhas', 'Campanhas aparecem nas buscas.'),
    ]),
    item('rf-13-5', 'RF 13.5', 'Compartilhamento', 'Cada campanha tem URL própria.'),
    item('rf-13-6', 'RF 13.6', 'Exibição pública', 'Somente campanhas Publicadas aparecem; rascunhos e arquivadas ficam ocultas.'),
    item('rf-13-7', 'RF 13.7', 'Padrão de criação', 'Factory Method e Template Method sustentam tipos futuros sem duplicação.'),
  ]),
  item('rf-14', 'RF 14', 'Seção de Projetos de Impacto', 'Exploração de iniciativas que o usuário ainda não segue.', [
    item('rf-14-1', 'RF 14.1', 'Aba de projetos', 'Aba dedicada para missionários e apoiadores.'),
    item('rf-14-2', 'RF 14.2', 'Visualização em cards', 'Foto, nome, título, descrição, capa e campanha.', [
      item('rf-14-2-1', 'RF 14.2.1', 'Título do projeto', 'Texto curto descritivo.'),
      item('rf-14-2-2', 'RF 14.2.2', 'Missionário responsável', 'Foto e nome do missionário.'),
      item('rf-14-2-3', 'RF 14.2.3', 'Descrição', 'Breve descrição ou slogan.'),
      item('rf-14-2-4', 'RF 14.2.4', 'Imagem de capa', 'Capa ilustrativa.'),
      item('rf-14-2-5', 'RF 14.2.5', 'Selo de campanha', 'Selo exibido quando associado.'),
      item('rf-14-2-6', 'RF 14.2.6', 'Título da campanha', 'Campanha relacionada exibida no card.'),
    ]),
    item('rf-14-3', 'RF 14.3', 'Interação com cards', 'Card leva ao perfil do missionário para seguir ou doar.'),
    item('rf-14-4', 'RF 14.4', 'Conteúdo sugerido e algoritmo', 'Curadoria administrativa antecede recomendações paginadas aleatórias.'),
  ]),
  item('rf-15', 'RF 15', 'Configurações de Conta', 'Área privada para credenciais e dados eclesiásticos.', [
    item('rf-15-1', 'RF 15.1', 'Acesso às configurações', 'Restrito ao próprio usuário autenticado.'),
    item('rf-15-2', 'RF 15.2', 'Credenciais de acesso', 'Altera e-mail com senha atual e redefine senha com confirmação.'),
    item('rf-15-3', 'RF 15.3', 'Dados eclesiásticos', 'Atualiza comunidade, endereço, site, telefones e pastor; após um mês pode exigir solicitação.'),
    item('rf-15-4', 'RF 15.4', 'Validações e segurança', 'Confere e-mail em uso e notifica alterações sensíveis.'),
    item('rf-15-5', 'RF 15.5', 'Exclusão e soft delete', 'Apoiadores podem ter hard delete; missionários e denúncias usam exclusão lógica.'),
  ]),
  item('rf-16', 'RF 16', 'Sistema de Denúncias', 'Denúncias únicas de perfis, projetos e postagens, com moderação.', [
    item('rf-16-1', 'RF 16.1', 'Denúncia de perfis', 'Menu do perfil abre o fluxo de denúncia.'),
    item('rf-16-2', 'RF 16.2', 'Denúncia de projetos', 'Menu do projeto permite denunciar uma vez.'),
    item('rf-16-3', 'RF 16.3', 'Denúncia de postagens', 'Menu da postagem permite denunciar uma vez.'),
    item('rf-16-4', 'RF 16.4', 'Modal de denúncia', 'Motivo obrigatório, opção Outro, confirmação e toast de sucesso ou falha.'),
    item('rf-16-5', 'RF 16.5', 'Suspensão por acúmulo', 'Dez denúncias de usuários diferentes aplicam soft delete e role suspensa.'),
    item('rf-16-6', 'RF 16.6', 'Alertas de suspensão', 'E-mail para administração e usuário; painel é atualizado.'),
  ]),
  item('rf-17', 'RF 17', 'Administração do Sistema', 'Provisionamento e autenticação administrativa controlados.', [
    item('rf-17-1', 'RF 17.1', 'Cadastro de administrador', 'Não permite auto-cadastro público.'),
    item('rf-17-2', 'RF 17.2', 'Autenticação administrativa', 'Verifica explicitamente a role de Administrador.'),
    item('rf-17-3', 'RF 17.3', 'Privilégios', 'Somente administradores aprovam missionários e gerenciam usuários.'),
  ]),
  item('rf-18', 'RF 18', 'Painel Administrativo', 'Aprovação, campanhas e moderação em uma área dedicada.', [
    item('rf-18-1', 'RF 18.1', 'Solicitações pendentes', 'Lista paginada de missionários pendentes.'),
    item('rf-18-2', 'RF 18.2', 'Interface de aprovação', 'Exibe dados básicos e ação Aprovar.'),
    item('rf-18-3', 'RF 18.3', 'Processamento da aprovação', 'Atualiza status e envia boas-vindas.', [
      item('rf-18-3-1', 'RF 18.3.1', 'Atualização de status', 'Torna o missionário ativo e apto a entrar.'),
      item('rf-18-3-2', 'RF 18.3.2', 'Notificação automática', 'Envia e-mail de aceitação.'),
    ]),
    item('rf-18-4', 'RF 18.4', 'Gerenciamento de campanhas', 'Cria página e lista curada de projetos.', [
      item('rf-18-4-1', 'RF 18.4.1', 'Listagem de campanhas', 'Título, status, projetos e datas.'),
      item('rf-18-4-2', 'RF 18.4.2', 'Operações administrativas', 'Criar, editar, publicar, arquivar, excluir e duplicar.'),
      item('rf-18-4-3', 'RF 18.4.3', 'Associação de projetos', 'Pesquisa, associa e remove sem duplicar o mesmo projeto.'),
      item('rf-18-4-4', 'RF 18.4.4', 'Controle de publicação', 'Alterna Rascunho, Publicada e Arquivada.'),
      item('rf-18-4-5', 'RF 18.4.5', 'Ordenação de destaques', 'Remove item individual ou esvazia lista com confirmação.'),
    ]),
    item('rf-18-5', 'RF 18.5', 'Denunciados e reativação', 'Lista contas suspensas, mostra dez denúncias e permite reativar.', [
      item('rf-18-5-1', 'RF 18.5.1', 'Aba de denunciados', 'Exibe identidade, contato e motivos das denúncias.'),
      item('rf-18-5-2', 'RF 18.5.2', 'Mecanismos de reativação', 'Restaura visibilidade e remove restrições.'),
    ]),
  ]),
  item('rf-19', 'RF 19', 'Histórico de Campanhas', 'Registro leve, auditável e consultável do ciclo das campanhas.', [
    item('rf-19-1', 'RF 19.1', 'Registro histórico', 'Campanha, datas, projetos associados e missionários relacionados.'),
    item('rf-19-2', 'RF 19.2', 'Restrição de armazenamento', 'Histórico guarda apenas textos e datas, nunca arquivos binários.'),
    item('rf-19-3', 'RF 19.3', 'Consulta do histórico', 'Consulta por campanha respeitando o período informado.'),
  ]),
];

export const nonFunctionalRequirements: RequirementNode[] = [
  item('rnf-1', 'NF.1', 'Segurança', 'Proteção de dados, privacidade e comunicação segura.', [
    item('rnf-1-1', 'NF 1.1', 'Criptografia de dados sensíveis', 'Hash forte para senhas e AES-256 para dados bancários.'),
    item('rnf-1-2', 'NF 1.2', 'Conformidade com a LGPD', 'Direito ao esquecimento, exportação e tratamento de dados sensíveis.'),
    item('rnf-1-3', 'NF 1.3', 'Proteção contra força bruta', 'Rate limiting e bloqueio temporário em autenticação.'),
    item('rnf-1-4', 'NF 1.4', 'Comunicação segura', 'HTTPS com TLS 1.2 ou superior e certificados válidos.'),
  ]),
  item('rnf-2', 'NF.2', 'Desempenho', 'Carregamento eficiente e capacidade de crescimento.', [
    item('rnf-2-1', 'NF 2.1', 'Otimização de imagens', 'Compressão de até 5MB para menos de 200KB, sem perda perceptível.'),
    item('rnf-2-2', 'NF 2.2', 'Tempo de carregamento', 'Feed e exploração em menos de dois segundos nos primeiros dez itens.'),
    item('rnf-2-3', 'NF 2.3', 'Paginação e lazy loading', 'Máximo de 20 itens por requisição ou scroll infinito.'),
    item('rnf-2-4', 'NF 2.4', 'Caching de alto volume', 'Redis para comunidades, contadores e curadoria.'),
    item('rnf-2-5', 'NF 2.5', 'Escalabilidade', 'Suporta picos de mil usuários sem degradação significativa.'),
  ]),
  item('rnf-3', 'NF.3', 'Usabilidade', 'Toda mudança de estado deve ser compreensível e imediata.', [
    item('rnf-3-1', 'NF 3.1', 'Feedback visual do sistema', 'Ações como salvar, doar e postar retornam feedback em menos de 100ms.'),
  ]),
  item('rnf-4', 'NF.4', 'Manutenibilidade', 'Base modular, observável e documentada.', [
    item('rnf-4-1', 'NF 4.1', 'Arquitetura evolutiva', 'Clean Architecture ou microsserviços permitem novas features sem refatoração profunda.'),
    item('rnf-4-2', 'NF 4.2', 'Documentação da API', 'Swagger ou OpenAPI facilita manutenção e futuro app móvel.'),
    item('rnf-4-3', 'NF 4.3', 'Monitoramento de erros', 'Sentry ou GlitchTip captura exceções de front e back-end.'),
    item('rnf-4-4', 'NF 4.4', 'Alertas de erro', 'Alerta em tempo real para falhas críticas, sobretudo doações.'),
    item('rnf-4-5', 'NF 4.5', 'Traçabilidade LGPD', 'Coleta contexto e trilha de navegação respeitando privacidade.'),
  ]),
  item('rnf-5', 'NF.5', 'Confiabilidade', 'Disponibilidade, atomicidade e entregabilidade.', [
    item('rnf-5-1', 'NF 5.1', 'Disponibilidade e uptime', 'Mínimo de 99,5% e página de doação sempre acessível.'),
    item('rnf-5-2', 'NF 5.2', 'Integridade transacional', 'Falhas intermediárias geram rollback e evitam estados inconsistentes.'),
    item('rnf-5-3', 'NF 5.3', 'Integridade de e-mails', 'Serviço transacional dedicado e entrega superior a 98%.'),
  ]),
  item('rnf-6', 'NF.6', 'Portabilidade', 'A experiência deve acompanhar missionários em campo.', [
    item('rnf-6-1', 'NF 6.1', 'Responsividade móvel', 'Interfaces funcionais a partir de 320px, com atenção a postagens e perfil.'),
  ]),
];

export const allRequirements: RequirementNode[] = [...functionalRequirements, ...nonFunctionalRequirements];

export const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();