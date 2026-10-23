export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Nova funcionalidade
        'fix',      // Correção de bug
        'docs',     // Documentação
        'style',    // Formatação, ponto e vírgula, etc (sem mudar código)
        'refactor', // Refatoração de código
        'perf',     // Melhoria de performance
        'test',     // Adição ou correção de testes
        'chore',    // Atualização de tarefas debuild, configs, etc
        'ci',       // Mudanças em arquivos de CI/CD
        'revert'    // Reversão de commit anterior
      ]
    ]
  }
};