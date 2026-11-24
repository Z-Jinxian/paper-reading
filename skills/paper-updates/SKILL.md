---
name: paper-updates
description: 追踪三个行业的重大公开进展，完成每日论文精读与独立技术选读。
---

# 远端论文推荐

## 每日上午的选读与维护

- 每次以北京时间当天为复核日，滚动计算半年和一年窗口。遵循 /skills/paper-screening/SKILL.md 与 /skills/paper-reading/SKILL.md。把大模型、自动驾驶、具身智能作为三个并列主方向，每轮都分别检索；Physical AI 只补充无人机、工业自动化、人机协作、闭环世界模型与 sim-to-real 等交叉方向，不替代三个主方向。跨运行查重并适当轮换方向。
- 每日精读先查所读版本的授权声明及许可原文。核验允许本站转载与翻译时，优先按页码／行范围取完整关键英文段，逐段保存 original、summary（忠实中译）、analysis（技术讲解）。在 source.note 注明作者、所读论文版本、许可名称、许可原文 URL 及翻译说明。许可范围不明时，保留原文定位，使用自撰英中释义，必要时附合规短引。
- 学术专题按长期贡献评估。本周新作和半年前工作在同一证据标准下竞争；发布日期仅在其他条件接近时作为同分项。不要因为“刚发布”、机构宣传或榜单名次直接入选。
- 每轮先形成跨领域候选池，通常至少六篇；大模型、自动驾驶、具身智能各至少两篇达到基本证据门槛的候选，再保留三至五篇短名单，尽量三类都有。某一类近半年不足时，只对该类扩到近一年并解释；仍不足则明确记录缺口。比较它们推进了哪条技术路线、拓展了哪些能力，核对支撑结论的原文证据和独立验证。最终入选按全局质量竞争，领域轮换只能用于质量相近的候选，不得为了凑齐方向降标准。
- 每轮为「每日推荐」新增一篇。优先在近半年选择证据最强、长期阅读价值最高的一篇；半年内没有达标候选时扩到一年并逐篇解释。首发、正式发表和阅读版本分别记录。新建专题逐步积累覆盖不同问题的三篇首读，历史专题内容持续保留。

## 入选门槛与排序

- 公开可读且通过 /skills/paper-screening/SKILL.md 的权威性硬门槛才可推荐：权威公司官方论文／技术报告，或已由权威顶会正式录用／发表。重点核验 Tesla、DeepSeek、OpenAI、Anthropic、Qwen、小米、地平线等公司官方来源。公司预印本须标明未核实会议录用；普通 arXiv 预印本不可仅凭实验强或背景贴合入选。逐篇记录通过路线和官方证据。
- 尊重网站当前的回收站及所有者明确排除的论文。

- 论文选读先过门槛再排序。论文候选须有可定位的原创贡献与相称的证据，能回答“领域此前做不到或解释不了什么，这篇推进了哪一步”。只有摘要、演示视频、机构宣传或作者自述时，先追查与主张匹配的原始证据。
- 按 /skills/paper-screening/SKILL.md 的领域重要性量尺判断，个人经历与项目匹配度不参与发现、入选或名次。前沿首页另计实际公开时间。
- 刚发布且尚无独立证据的论文，先满足权威性硬门槛，再核验与其贡献相称的原始证据。否则先放候选观察，不抢占每日推荐。
- 选读应有可核验的技术贡献、实验设置和明确边界。
- 通过 Sites get_site 获取本网站的最新服务访问凭据，仅向同一站发送 OAI-Sites-Authorization Bearer 头。凭据只放进进程内存和标准输入，不写入文件、日志或提示词。所有 API 请求加 x-notebook-request 为 1。不需要访客身份或模型配置。
- GET /api/library 返回 {papers, topics}。先查 DOI、arXiv ID、标题及来源链接，重试时复用同一记录与 revision，避免重复。GET 本 Skill 和另外两个 Skill 获取现行规则。
- 主专题使用 topics 中最契合的 ID，确需新专题时 POST /api/topics，JSON 为 {name}，使用返回 ID。PUT /api/papers/user-<UUID> 使用 multipart/form-data，字段 revision 为 0，note 为 JSON。更新已有记录时使用其 ID 与最新 revision。409 时重新读取并合并，保留原笔记和上传文件。
- note 基本字段为 title, category, additionalCategories（其他板块ID数组）, venue, reason, tags, thesis, source {landing,pdf,version,note}, sections, formulas, example {title,setup,steps,takeaway}, limits。sections 含 heading, background, why, passageNotes, details, asset, alt, page。每条 passageNotes 按来源顺序保存 page/from/to、original（可使用的原文）或 english（自撰英文释义）、summary（与此段对应的中译或中文释义）及 analysis（该段重要性、机制和证据）。formulas 含 name,original,latex,symbols 二元组数组,steps,scope,principle,numericExample,asset 空字符串,alt,page,afterPassage（该章节第几段后插入，1起始）。original须含§归属节号。页码须从同一版 PDF 核实。已知缺口写入 limits，不编造截图和数字。
- note.recommendation 为 {date:北京时间 YYYY-MM-DD, importance:0到100, evidence:筛选和排序理由}。按 /skills/paper-screening/SKILL.md 的综合重要性量尺评估，定位与相邻论文相比最关键的贡献和证据。date 只在首次推荐时设置，重试和精读补充保留原日期与当次评分。
- recommendation.evidence 同时写入：候选池规模、进入短名单的论文、主要落选原因、入选论文相对前沿的实质推进，以及仍缺少的独立证据。不得只写入选论文的优点。

## 领域论文库与半年覆盖

- 每条推荐保存时就挂到大模型、具身智能与机器人、自动驾驶中的一个或多个归档板块，必要时再挂方法专题。离开半年窗口后继续保留原来的领域条目与精读。
- GET /api/library 的 frontier 提供 today、start、models、robotics、driving 和 technologies，分别检查大模型、具身智能与机器人、自动驾驶三个列表，按论文 ID 去重计数。models 至少十篇，robotics 与 driving 的去重并集至少十篇，分别报告各领域的覆盖量。embodied 是供旧接口调用者使用的并集。领域收录通过 category 和 additionalCategories 关联；大模型用 large-models，具身智能与机器人用 embodied-robotics，自动驾驶使用 topics 中“自动驾驶”的实际 ID。
- 优先以近半年的首次公开或正式会议／期刊日期为核验时间，会议录用、修订和卷宗补录须注明。新增精选均写 note.frontier={date,firstPublic,lesson,evidence}。date 是正式发表日或初次公开日，支持 YYYY-MM-DD 和 YYYY-MM（月粒度按月初保守判断）；firstPublic 单列首次公开记录，lesson 写明研究发现及其领域意义，evidence 包括对照、指标、适用条件与一手出处。经典与一年扩窗论文可保留在归档，不计入半年保底。
- 逐日检查未来七天将出窗的条目；提前补入有质量的候选，让现有覆盖量留有余量。可一次补入多条精选导读，只有当天推荐的那篇附 recommendation。优先复用现有论文与精读；所有合格新作也可跨组、跨专题展示。删除标记继续生效。
- 新证据可在对应论文写入 note.paradigm={name,meaning,change,evidence,limit,source,date}。同名沿用稳定名称；date 是证据日期，source 是 HTTPS 一手来源。证据栏保留关键早期对照及新结果。最新版自动显示于「最新技术」，原论文仍在档。没有实质新证据时保留原条目。
- 未指定专题的通用前沿进入大模型、具身智能与机器人或自动驾驶板块，也可同时保留技术专题。查重后复用同一论文ID，以additionalCategories增加展示位置；不新建重复实体，不因新增展示位置重设推荐日期。按当日读者要做的技术判断选择关键段落。沿原文顺序完成每段英文、对应中文、重要技术解释，再就地放公式、同组数字手算及可检验的预测。重大突破说明此前瓶颈、作者的新选择、决定性对照与尚缺的证据；架构或损失重要时，用一条样本走过中间量，分别检查训练梯度和推理数据流。

- 首页沿用推荐卡片，大模型（large-models）、具身智能与机器人（embodied-robotics）、自动驾驶（按 topics 中实际 ID）各自独立展示。每个领域只有一个板块，半年窗口通过 frontier 数据维护，复用领域内的同一条记录。
- 所有新增论文保存 readingImportance（0–100），按现行筛选规则评估。跨专题复用同一条记录与阅读评分。更新既有笔记时保留原分，出现足以改变相对次序的新证据时再复核。
- 首页验证全部专题的论文 ID 唯一且在各自专题内按重要度降序，每个领域只显示一个板块。方法专题可交叉收录。

## 每日执行与日报

- 按 /skills/technology-updates/SKILL.md 先检查三个行业的真实发布，再完成常规论文精读。先写实质重大进展，资料类型与发表状态如实标注。每日完整复核最近七天，以各领域上次成功核查时间回补断档。若停留在搜索结果或单个来源不可达，换用该团队的其他一手入口，并如实记录覆盖缺口。
- 每日仍选读一篇重要论文、一项值得深读的技术，有适合的同一论文可复用。常规选读标记各最多占一天一个位置；技术事件单独按事件身份记录。不限重大条数，双栏引用同一条，不覆盖当天精读。综合排序、十条保底与 Outlook 日报按最新技术规则。
- 每日 GET /api/frontier/digest 获取 day、through、subject、html 和 receipt；/frontier-digest 为同一内容的可读预览。确认送达后 PUT /api/frontier/deliveries/{day}，JSON 含本次内容的 through 和邮件方确认的 messageId。已有当日回执直接复用。待发送的实质变化从上一份成功日报的截止时刻开始累计；回执缺失时据已发送邮件核验。发信渠道已连接时仅发送到用户自己已确认的 Outlook 地址。使用 HTML 正文与带日期的唯一主题，重大条目标题内联红色加粗并带【重大进展】文字；普通标题使用正文颜色。发送前检查「已发送」中的同一主题，发生不确定超时先核对已发送回执。无法确认收件人、HTML 投递权限或成功回执时，如实标注具体缺口，不把任务完成状态当成邮件已送达。小时巡检只更新网页，常规邮件仍为每日一封。
