const { InteractionType, EmbedBuilder } = require("discord.js");

module.exports = {
  name: "interactionCreate",
  async run(interaction, client) {
    try {
      if (interaction.type !== InteractionType.ApplicationCommand) return;

      const comando = client.slashCommands.get(interaction.commandName);

      if (!comando) {
        const embedNaoEncontrado = new EmbedBuilder()
          .setTitle("Comando Não Encontrado")
          .setDescription(`O comando **${interaction.commandName}** não foi encontrado no sistema.`)
          .setFooter({ text: "Erro de Comando", iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        return interaction.reply({ embeds: [embedNaoEncontrado], ephemeral: true });
      }

      interaction.member = interaction.guild.members.cache.get(interaction.user.id);

      if (comando.permissions && !interaction.member.permissions.has(comando.permissions)) {
        const embedSemPermissao = new EmbedBuilder()
          .setTitle("Permissões Insuficientes")
          .setDescription(
            `Você não possui as permissões necessárias para executar o comando **${interaction.commandName}**.` +
            `\n🔒 Permissões Requeridas: \`${comando.permissions.join(", ")}\``
          )
          .setFooter({ text: "Restrição de Permissões", iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        return interaction.reply({ embeds: [embedSemPermissao], ephemeral: true });
      }

      await comando.run(client, interaction);
    } catch (erro) {
      console.error(`Erro no evento interactionCreate: ${erro.message}`, erro);

      const embedErro = new EmbedBuilder()
        .setTitle("Erro Interno do Sistema")
        .setDescription("Ocorreu um erro inesperado. Tente novamente ou contate o suporte.")
        .addFields(
          { name: "Comando", value: `\`${interaction.commandName || "Desconhecaido"}\``, inline: true },
          { name: "Usuário", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Erro", value: `\`\`\`js\n${erro.message}\`\`\`` }
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: "Erro Interno", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ embeds: [embedErro] });
        } else {
          await interaction.reply({ embeds: [embedErro], ephemeral: true });
        }
      } catch (erroResposta) {
        console.error("Erro ao enviar mensagem de erro:", erroResposta);
      }
    }
  },
};
