(function () {
    const HW = window.HW = window.HW || {};

    HW.config = {
        stateKey: 'hw_generator_state_v40',
        page: { width: 800, height: 1131 },
        localExporterUrl: 'http://127.0.0.1:8765/export',
        controls: [
            'padTop', 'padBottom', 'padLeft', 'padRight',
            'fontSize', 'mathSize', 'lineHeight', 'wobble',
            'lineSlant', 'charTilt', 'charY', 'charX',
            'charScale', 'letterSpace', 'inkSize', 'scribbleRand'
        ],
        defaults: {
            modes: { tiltMode: 'random', yMode: 'random', slantMode: 'random' },
            scribbleStyle: '1',
            inkStyle: '1',
            textFont: 'default',
            mathFont: 'default'
        },
        fonts: {
            text: [
                { id: 'bt_chen', name: '辰宇落雁体', url: './fonts/正文字体/ChenYuluoyan-2.0-Thin.ttf' },
                { id: 'bt_honglei', name: '洪雷拙书', url: './fonts/正文字体/HongLeiZhuoShuJianTi-2.ttf' },
                { id: 'bt_lixu', name: '李旭科行书', url: './fonts/正文字体/LiXuKeJingDianXingShu-2.ttf' },
                { id: 'bt_yozai', name: '悠哉字体', url: './fonts/正文字体/Yozai-Medium.ttf' },
                { id: 'bt_yiqi', name: '义启手写体', url: './fonts/正文字体/义启手写体.ttf' },
                { id: 'bt_yunyan', name: '云烟体', url: './fonts/正文字体/云烟体.ttf' },
                { id: 'bt_ximai', name: '喜脉喜欢体', url: './fonts/正文字体/字制区喜脉喜欢体.ttf' },
                { id: 'bt_liguofu', name: '李国夫手写体', url: './fonts/正文字体/李国夫手写体.ttf' },
                { id: 'bt_qingye', name: '青叶手写体', url: './fonts/正文字体/青叶手写体.ttf' },
                { id: 'bt_fanmeng', name: '温柔奶酪体', url: './fonts/正文字体/FanMengWenRouNaiLaoTi-2.ttf' },
                { id: 'bt_qianrou', name: '芊柔体', url: './fonts/正文字体/【嵐】芊柔体.ttf' },
                { id: 'bt_zhaojiujiang', name: '赵九江钢笔行书', url: './fonts/正文字体/书体坊赵九江钢笔行书.ttf' },
                { id: 'bt_jingboran', name: '井柏然体', url: './fonts/正文字体/井柏然体.ttf' },
                { id: 'bt_jilishouxie', name: '吉力手写简体', url: './fonts/正文字体/吉力手写简体.ttf' },
                { id: 'bt_myhand', name: '我的手写体', url: './fonts/正文字体/我的手写体.ttf' },
                { id: 'bt_daijin', name: '戴锦好字体X', url: './fonts/正文字体/戴锦好字体X.ttf' },
                { id: 'bt_wangwei', name: '王伟钢笔行书', url: './fonts/正文字体/方正字迹-王伟钢笔行书简体.ttf' },
                { id: 'bt_jinglei', name: '方正静蕾简体', url: './fonts/正文字体/方正静蕾简体.ttf' },
                { id: 'bt_xingjuan', name: '星眷硬笔初行草', url: './fonts/正文字体/星眷硬笔书法初行草++.ttf' },
                { id: 'bt_luoxi', name: '罗西钢笔行楷', url: './fonts/正文字体/罗西钢笔行楷.ttf' },
                { id: 'bt_zhulang', name: '逐浪时尚钢笔体', url: './fonts/正文字体/逐浪时尚钢笔体.ttf' },
                { id: 'bt_xingshixin', name: '邢世新硬笔行书', url: './fonts/正文字体/邢世新硬笔行书简体.ttf' },
                { id: 'bt_anjingchen', name: '钟齐安景臣硬笔行书', url: './fonts/正文字体/钟齐安景臣硬笔行书.otf' },
                { id: 'bt_chenjishi', name: '陈继世硬笔行书', url: './fonts/正文字体/陈继世-硬笔行书.ttf' },
                { id: 'bt_huangyanwen', name: '黄彦文行书字体', url: './fonts/正文字体/黄彦文行书字体.ttf' }
            ],
            math: [
                { id: 'bm_arch', name: 'Architects Daughter', url: './fonts/公式字体/ArchitectsDaughter-Regular.ttf' },
                { id: 'bm_caveat', name: 'Caveat', url: './fonts/公式字体/Caveat-Regular.ttf' },
                { id: 'bm_comic', name: 'Comic Shanns', url: './fonts/公式字体/comic shanns 2.ttf' },
                { id: 'bm_gochi', name: 'Gochi Hand', url: './fonts/公式字体/GochiHand-Regular.ttf' },
                { id: 'bm_kalam_b', name: 'Kalam Bold', url: './fonts/公式字体/Kalam-Bold.ttf' },
                { id: 'bm_kalam_l', name: 'Kalam Light', url: './fonts/公式字体/Kalam-Light.ttf' },
                { id: 'bm_kalam_r', name: 'Kalam Regular', url: './fonts/公式字体/Kalam-Regular.ttf' },
                { id: 'bm_neucha', name: 'Neucha', url: './fonts/公式字体/Neucha.ttf' },
                { id: 'bm_shadows', name: 'Shadows Into Light', url: './fonts/公式字体/ShadowsIntoLight-Regular.ttf' },
                { id: 'bm_virgil', name: 'Virgil', url: './fonts/公式字体/Virgil.woff2' },
                { id: 'bm_snowren', name: 'SNOWREN 建刚体', url: './fonts/公式字体/SNOWREN建刚体.ttf' },
                { id: 'bm_mobasui', name: '墨八岁简体', url: './fonts/公式字体/墨八岁简体.ttf' },
                { id: 'bm_daijin', name: '戴锦好字体X', url: './fonts/公式字体/戴锦好字体X.ttf' },
                { id: 'bm_rangkang', name: '攘康采锾篦', url: './fonts/公式字体/攘康采锾篦.ttf' }
            ]
        }
    };

    HW.state = {
        modes: { ...HW.config.defaults.modes },
        scribbleStyle: HW.config.defaults.scribbleStyle,
        inkStyle: HW.config.defaults.inkStyle,
        textFont: HW.config.defaults.textFont,
        mathFont: HW.config.defaults.mathFont,
        renderSeed: 1,
        source: ''
    };
})();
