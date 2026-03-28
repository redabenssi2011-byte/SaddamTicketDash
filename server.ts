import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, PermissionFlagsBits, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase for server-side
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Bot Manager to handle persistent connections
const botClients = new Map<string, Client>();

async function createTicket(interaction: any, categoryName: string, config: any = {}) {
  const guild = interaction.guild;
  if (!guild) return;

  const channelName = `ticket-${interaction.user.username}-${categoryName}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
  
  try {
    const existingChannel = guild.channels.cache.find(c => c.name === channelName);
    if (existingChannel) {
      return interaction.reply({ content: `لديك تذكرة مفتوحة بالفعل في هذا القسم: ${existingChannel}`, ephemeral: true });
    }

    // Prepare permissions
    const permissionOverwrites: any[] = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
    ];

    // Add support roles to permissions
    if (config.supportRoles && Array.isArray(config.supportRoles)) {
      config.supportRoles.forEach((roleId: string) => {
        permissionOverwrites.push({
          id: roleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
      });
    }

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites,
    });

    const embed = new EmbedBuilder()
      .setTitle(`Saddam Ticket | ${categoryName}`)
      .setDescription(`مرحباً ${interaction.user}\nتم إنشاء تذكرتك بنجاح في قسم **${categoryName}**. يرجى انتظار رد الإدارة.\n\nWelcome! Please wait for an admin to respond.`)
      .setColor(config.color || 0xF27D26)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: "Saddam Ticket System", iconURL: interaction.client.user?.displayAvatarURL() });

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('mention_admin')
          .setLabel('منشن الإدارة / Mention Admin')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('إغلاق / Close')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setLabel('Saddam Ticket')
          .setStyle(ButtonStyle.Link)
          .setURL('https://ais-dev-jp7qpbyhtmy6v7pbo2etcc-455332564082.europe-west2.run.app')
      );

    // Prepare mentions
    let mentionContent = `${interaction.user}`;
    if (config.mentionRoles && Array.isArray(config.mentionRoles) && config.mentionRoles.length > 0) {
      mentionContent += ` ${config.mentionRoles.map((id: string) => `<@&${id}>`).join(' ')}`;
    } else {
      mentionContent += ` <@&${guild.ownerId}>`;
    }

    await channel.send({ content: mentionContent, embeds: [embed], components: [row] });
    await interaction.reply({ content: `تم إنشاء التذكرة بنجاح: ${channel}`, ephemeral: true });
  } catch (error) {
    console.error("Ticket Creation Error:", error);
    await interaction.reply({ content: "حدث خطأ أثناء إنشاء التذكرة. تأكد من صلاحيات البوت.", ephemeral: true });
  }
}

async function setupBot(token: string) {
  if (botClients.has(token)) return botClients.get(token)!;

  const client = new Client({ 
    intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.GuildMessages
    ] 
  });

    client.on('interactionCreate', async (interaction) => {
      // Handle Buttons
      if (interaction.isButton()) {
        const embed = interaction.message.embeds[0];
        const footer = embed?.footer?.text;
        let config: any = {};
        
        if (footer && footer.startsWith('Saddam Config: ')) {
          try {
            const rawConfig = JSON.parse(footer.replace('Saddam Config: ', ''));
            config = {
              color: rawConfig.c,
              supportRoles: rawConfig.s,
              mentionRoles: rawConfig.m
            };
          } catch (e) { console.error("Error parsing config:", e); }
        } else {
          config.color = embed?.color;
        }

        if (interaction.customId.startsWith('ticket_btn_')) {
          const parts = interaction.customId.split('_');
          const category = parts[3] || 'General';
          await createTicket(interaction, category, config);
        }

        if (interaction.customId === 'mention_admin') {
          let mentionContent = "تنبيه للإدارة!";
          if (config.mentionRoles && config.mentionRoles.length > 0) {
            mentionContent = config.mentionRoles.map((id: string) => `<@&${id}>`).join(' ');
          }
          await interaction.channel?.send({ content: `${mentionContent} - ${interaction.user} يحتاج للمساعدة!` });
          await interaction.reply({ content: "تم إرسال تنبيه للإدارة!", ephemeral: true });
        }

        if (interaction.customId === 'close_ticket') {
          await interaction.reply({ content: "سيتم إغلاق التذكرة خلال 5 ثوانٍ...", ephemeral: true });
          setTimeout(async () => {
            try {
              await interaction.channel?.delete();
            } catch (e) {
              console.error("Delete Channel Error:", e);
            }
          }, 5000);
        }
      }

    // Handle Select Menus
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket_select') {
        const selectedValue = interaction.values[0];
        
        let config: any = {};
        const embed = interaction.message.embeds[0];
        const footer = embed?.footer?.text;
        
        if (footer && footer.startsWith('Saddam Config: ')) {
          try {
            const rawConfig = JSON.parse(footer.replace('Saddam Config: ', ''));
            config = {
              color: rawConfig.c,
              supportRoles: rawConfig.s,
              mentionRoles: rawConfig.m
            };
          } catch (e) { console.error("Error parsing config:", e); }
        } else {
          config.color = embed?.color;
        }

        await createTicket(interaction, selectedValue, config);
      }
    }
  });

  try {
    await client.login(token);
    botClients.set(token, client);
    console.log(`Bot logged in: ${client.user?.tag}`);
    return client;
  } catch (e) {
    console.error(`Failed to login bot with token: ${token.substring(0, 10)}...`);
    throw e;
  }
}

// Load all bots from Firestore on startup
async function loadAllBots() {
  try {
    const querySnapshot = await getDocs(collection(db, "bots"));
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      if (data.token) {
        setupBot(data.token).catch(() => {});
      }
    }
  } catch (e) {
    console.error("Error loading bots from Firestore:", e);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize bots
  // loadAllBots(); // Commented out due to Firestore permission restrictions on server-side client SDK

  // API Routes
  app.post("/api/discord/verify", async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });

    try {
      const client = await setupBot(token);
      const user = client.user;
      if (!user) throw new Error("User not found");
      
      res.json({
        id: user.id,
        username: user.username,
        avatar: user.displayAvatarURL(),
        tag: user.tag
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message || "Invalid token" });
    }
  });

  app.post("/api/discord/guilds", async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });

    try {
      const client = await setupBot(token);
      const guilds = client.guilds.cache.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.iconURL()
      }));
      res.json(guilds);
    } catch (error: any) {
      res.status(401).json({ error: error.message || "Invalid token" });
    }
  });

  app.post("/api/discord/channels", async (req, res) => {
    const { token, guildId } = req.body;
    if (!token || !guildId) return res.status(400).json({ error: "Token and Guild ID are required" });

    try {
      const client = await setupBot(token);
      const guild = await client.guilds.fetch(guildId);
      const channels = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText)
        .map(c => ({ id: c.id, name: c.name }));
      res.json(channels);
    } catch (error: any) {
      res.status(401).json({ error: error.message || "Invalid token" });
    }
  });

  app.post("/api/discord/roles", async (req, res) => {
    const { token, guildId } = req.body;
    if (!token || !guildId) return res.status(400).json({ error: "Token and Guild ID are required" });

    try {
      const client = await setupBot(token);
      const guild = await client.guilds.fetch(guildId);
      const roles = await guild.roles.fetch();
      const rolesData = roles
        .filter(r => r.name !== "@everyone" && !r.managed)
        .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
      res.json(rolesData);
    } catch (error: any) {
      console.error("Fetch Roles Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch roles" });
    }
  });

  app.post("/api/discord/send-panel", async (req, res) => {
    const { token, guildId, channelId, title, description, imageUrl, buttons, panelType, placeholder, color, supportRoles, mentionRoles } = req.body;
    if (!token || !channelId) return res.status(400).json({ error: "Missing required fields" });

    try {
      const client = await setupBot(token);
      const channel = await client.channels.fetch(channelId) as TextChannel;
      if (!channel) throw new Error("Channel not found");

      const embedColor = color ? parseInt(color.replace('#', ''), 16) : 0xF27D26;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(embedColor);

      if (imageUrl) embed.setImage(imageUrl);

      const configStr = JSON.stringify({
        c: embedColor,
        s: supportRoles || [],
        m: mentionRoles || []
      });
      embed.setFooter({ text: `Saddam Config: ${configStr}` });

      const row = new ActionRowBuilder<any>();
      
      if (panelType === 'select') {
        const select = new StringSelectMenuBuilder()
          .setCustomId('ticket_select')
          .setPlaceholder(placeholder || 'اختر قسم التذكرة...')
          .addOptions(
            buttons.map((btn: any) => 
              new StringSelectMenuOptionBuilder()
                .setLabel(btn.label)
                .setDescription(btn.description || '')
                .setValue(btn.label)
            )
          );
        row.addComponents(select);
      } else {
        buttons.forEach((btn: any, index: number) => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_btn_${index}_${btn.label}`)
              .setLabel(btn.label)
              .setStyle(ButtonStyle.Primary)
          );
        });
      }

      await channel.send({ embeds: [embed], components: [row] });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send message" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
