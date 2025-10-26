/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findStoreLazy } from "@webpack";
import { Menu, React, UserStore } from "@webpack/common";
let selectedBadges: Set<string> = new Set();

function setupBadgeImageFixer() {
    const BADGE_IMG_SELECTOR = 'img[src*="/badge-icons/"]';

    function tryFix(img: HTMLImageElement) {
        try {
            const src = img.getAttribute("src") || "";
            if (src.includes("/badge-icons/https://") || src.includes("/badge-icons/http://") || src.includes("/badge-icons/data:")) {
                const m = src.match(/\/badge-icons\/(.+?)(?:\.(?:png|webp|jpg|jpeg|gif))(?:\?|$)/i) || src.match(/\/badge-icons\/(.+)$/i);
                if (!m) return;
                let raw = m[1];
                try { raw = decodeURIComponent(raw); } catch { }
                raw = raw.replace(/%2F/gi, "/");
                if (/^(https?:|data:)/.test(raw)) {
                    img.referrerPolicy = "no-referrer";
                    img.loading = "eager";
                    img.decoding = "async";
                    img.src = raw;
                }
            }
        } catch { }
    }

    document.querySelectorAll(BADGE_IMG_SELECTOR).forEach(img => tryFix(img as HTMLImageElement));
    const mo = new MutationObserver(muts => {
        for (const mut of muts) {
            mut.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if ((node as Element).matches?.(BADGE_IMG_SELECTOR)) tryFix(node as HTMLImageElement);
                (node as Element).querySelectorAll?.(BADGE_IMG_SELECTOR).forEach(img => tryFix(img as HTMLImageElement));
            });
        }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
}

const AVAILABLE_BADGES = [
    { id: "staff", description: "Discord Staff", icon: "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png" },
    { id: "nitro", description: "Subscriber since Jan 1, 2099", icon: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png" },
    { id: "nitro_bronze", description: "Nitro Bronze", icon: "https://cdn.discordapp.com/badge-icons/4f33c4a9c64ce221936bd256c356f91f.png" },
    { id: "old_nitro_bronze", description: "Nitro Bronze (old)", icon: "https://cdn.discordapp.com/badge-icons/19a1562a9ce21227116624daaf69e450.png" },
    { id: "nitro_silver", description: "Nitro Silver", icon: "https://cdn.discordapp.com/badge-icons/4514fab914bdbfb4ad2fa23df76121a6.png" },
    { id: "old_nitro_silver", description: "Nitro Silver (old)", icon: "https://cdn.discordapp.com/badge-icons/3d533bea11ec4f7bdbf23a4bdc7a373f.png" },
    { id: "nitro_gold", description: "Nitro Gold", icon: "https://cdn.discordapp.com/badge-icons/2895086c18d5531d499862e41d1155a6.png" },
    { id: "old_nitro_gold", description: "Nitro Gold (old)", icon: "https://cdn.discordapp.com/badge-icons/850a7f5909f9d54d6ad986c096937911.png" },
    { id: "nitro_platinum", description: "Nitro Platinum", icon: "https://cdn.discordapp.com/badge-icons/0334688279c8359120922938dcb1d6f8.png" },
    { id: "old_nitro_platinum", description: "Nitro Platinum (old)", icon: "https://cdn.discordapp.com/badge-icons/3393b2ca6e25e40d4bb3bd23d60d0cdd.png" },
    { id: "nitro_diamond", description: "Nitro Diamond", icon: "https://cdn.discordapp.com/badge-icons/0d61871f72bb9a33a7ae568c1fb4f20a.png" },
    { id: "old_nitro_diamond", description: "Nitro Diamond (old)", icon: "https://cdn.discordapp.com/badge-icons/7c85d3834db671b01e6d0fd1538663a0.png" },
    { id: "nitro_emerald", description: "Nitro Emerald", icon: "https://cdn.discordapp.com/badge-icons/11e2d339068b55d3a506cff34d3780f3.png" },
    { id: "old_nitro_emerald", description: "Nitro Emerald (old)", icon: "https://cdn.discordapp.com/badge-icons/2447661dbda1a992a616a583f8492ae3.png" },
    { id: "nitro_ruby", description: "Nitro Ruby", icon: "https://cdn.discordapp.com/badge-icons/cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4.png" },
    { id: "old_nitro_ruby", description: "Nitro Ruby (old)", icon: "https://cdn.discordapp.com/badge-icons/ddb868782712aa9f4ef98bef4d6e14f6.png" },
    { id: "nitro_opal", description: "Nitro Opal", icon: "https://cdn.discordapp.com/badge-icons/5b154df19c53dce2af92c9b61e6be5e2.png" },
    { id: "nitro_fire", description: "Nitro Fire", icon: "https://cdn.discordapp.com/badge-icons/cff7119d4417261c3f52fde8a94ba8e5.png" },
    { id: "partner", description: "Partnered Server Owner", icon: "https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png" },
    { id: "old_partner", description: "Partnered Server Owner (old)", icon: "https://i.ibb.co/60v86C4D/Ywjiwvt.png" },
    { id: "mod_alumni", description: "Moderator Programs Alumni", icon: "https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png" },
    { id: "old_mod_alumni", description: "Moderator Programs Alumni (old)", icon: "https://i.ibb.co/bjgmWgfN/5jRAgjg.png" },
    { id: "hypesquad_events", description: "HypeSquad Events", icon: "https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png" },
    { id: "hypesquad_old", description: "HypeSquad (old)", icon: "https://i.ibb.co/tpzZcKMc/hpFqxp1.png" },
    { id: "hypesquad_bravery", description: "HypeSquad Bravery", icon: "https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png" },
    { id: "hypesquad_brilliance", description: "HypeSquad Brilliance", icon: "https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png" },
    { id: "hypesquad_balance", description: "HypeSquad Balance", icon: "https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png" },
    { id: "hypesquad_balance2", description: "HypeSquad Balance2", icon: "https://i.ibb.co/XBBcsPZ/mYRnJbI.png" },
    { id: "hypesquad_balance3", description: "HypeSquad Balance3", icon: "https://i.ibb.co/VWt8btqS/ris927572961sst1761412742.png" },
    { id: "hypesquad_bravery2", description: "HypeSquad Bravery2", icon: "https://i.ibb.co/yFFFYRFB/6P52dYE.png" },
    { id: "hypesquad_brilliance2", description: "HypeSquad Brilliance2", icon: "https://i.ibb.co/b5xzh7hg/m79FdLS.png" },
    { id: "hypesquad_balance4", description: "HypeSquad Balance4", icon: "https://i.ibb.co/KzBypwND/f7BT6fF.png" },
    { id: "bug_hunter", description: "Discord Bug Hunter", icon: "https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png" },
    { id: "bug_hunter_gold", description: "Discord Bug Hunter", icon: "https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png" },
    { id: "active_developer", description: "Active Developer", icon: "https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png" },
    { id: "early_verified_bot_dev", description: "Early Verified Bot Developer", icon: "https://cdn.discordapp.com/badge-icons/6df5892e0f35b051f8b61eace34f4967.png" },
    { id: "early_supporter", description: "Early Supporter", icon: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png" },
    { id: "old_boost_1m", description: "Boost 1 Month", icon: "https://i.ibb.co/NdRrhyp2/TXvfcRR.png" },
    { id: "old_boost_2m", description: "Boost 2 Months", icon: "https://i.ibb.co/S4BnMkgG/B38uGrA.png" },
    { id: "old_boost_3m", description: "Boost 3 Months", icon: "https://i.ibb.co/whNfkx7p/APZkNLz.png" },
    { id: "old_boost_6m", description: "Boost 6 Months", icon: "https://i.ibb.co/xtXyvCJQ/xRurzDc.png" },
    { id: "boost_1m", description: "Boost 1 Month", icon: "https://cdn.discordapp.com/badge-icons/51040c70d4f20a921ad6674ff86fc95c.png" },
    { id: "boost_2m", description: "Boost 2 Months", icon: "https://cdn.discordapp.com/badge-icons/0e4080d1d333bc7ad29ef6528b6f2fb7.png" },
    { id: "boost_3m", description: "Boost 3 Months", icon: "https://cdn.discordapp.com/badge-icons/72bed924410c304dbe3d00a6e593ff59.png" },
    { id: "boost_6m", description: "Boost 6 Months", icon: "https://cdn.discordapp.com/badge-icons/df199d2050d3ed4ebf84d64ae83989f8.png" },
    { id: "boost_9m", description: "Boost 9 Months", icon: "https://cdn.discordapp.com/badge-icons/996b3e870e8a22ce519b3a50e6bdd52f.png" },
    { id: "boost_12m", description: "Boost 12 Months", icon: "https://cdn.discordapp.com/badge-icons/991c9f39ee33d7537d9f408c3e53141e.png" },
    { id: "boost_15m", description: "Boost 15 Months", icon: "https://cdn.discordapp.com/badge-icons/cb3ae83c15e970e8f3d410bc62cb8b99.png" },
    { id: "boost_18m", description: "Boost 18 Months", icon: "https://cdn.discordapp.com/badge-icons/7142225d31238f6387d9f09efaa02759.png" },
    { id: "boost_24m", description: "Boost 24 Months", icon: "https://cdn.discordapp.com/badge-icons/ec92202290b48d0879b7413d2dde3bab.png" },
    { id: "new_boost_1m", description: "Boost 1 Month", icon: "https://i.ibb.co/1tFQ1c1d/0su0PqO.gif" },
    { id: "new_boost_2m", description: "Boost 2 Months", icon: "https://i.ibb.co/Y7qd9SqJ/IQXEwtW.gif" },
    { id: "new_boost_3m", description: "Boost 3 Months", icon: "https://i.ibb.co/YBgchYYP/YThyOs7.gif" },
    { id: "new_boost_6m", description: "Boost 6 Months", icon: "https://i.ibb.co/XkNKXvqQ/5pe2rTB.gif" },
    { id: "new_boost_9m", description: "Boost 9 Months", icon: "https://i.ibb.co/4RQgj0D7/7aerpNo.gif" },
    { id: "new_boost_12m", description: "Boost 12 Months", icon: "https://i.ibb.co/ccxKmzd3/FCHg73e.gif" },
    { id: "new_boost_15m", description: "Boost 15 Months", icon: "https://i.ibb.co/sv4dWmtD/s4Lg8ur.gif" },
    { id: "new_boost_18m", description: "Boost 18 Months", icon: "https://i.ibb.co/vxJ1JJt0/LPuBKUl.gif" },
    { id: "new_boost_24m", description: "Boost 24 Months", icon: "https://i.ibb.co/fzN8YWKY/9mJTrOZ.gif" },
    { id: "pomelo_old", description: "Originally known as Discord#0000", icon: "https://i.ibb.co/Xxbtt9tc/aa08X9e.png" },
    { id: "pomelo", description: "Originally known as Discord#0000", icon: "https://cdn.discordapp.com/badge-icons/6de6d34650760ba5551a79732e98ed60.png" },
    { id: "clown", description: "A clown, for a limited time", icon: "https://i.ibb.co/9M1pDvJ/nnnzQos.png" },
    { id: "quest", description: "Completed a Quest", icon: "https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png" },
    { id: "orb", description: "Orbs Apprentice", icon: "https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png" },
    { id: "supports_commands", description: "Supports Commands", icon: "https://cdn.discordapp.com/badge-icons/6f9e37f9029ff57aef81db857890005e.png" },
    { id: "premium_app", description: "Premium App", icon: "https://i.ibb.co/0pfp0TD3/KYXZbLw.png" },
    { id: "automod", description: "Uses AutoMod", icon: "https://cdn.discordapp.com/badge-icons/f2459b691ac7453ed6039bbcfaccbfcd.png" },
];


function loadSavedBadges() {
    try {
        const saved = localStorage.getItem('badgeSelector_selectedBadges');
        if (saved) {
            const badgeIds = JSON.parse(saved);
            selectedBadges = new Set(badgeIds);
            badgeIds.forEach((badgeId: string) => {
                const badge = AVAILABLE_BADGES.find(b => b.id === badgeId);
                if (badge) {
                    addBadge(badge);
                }
            });
        }
    } catch (error) {
        console.error('Failed to load saved badges:', error);
    }
}

function saveBadges() {
    try {
        localStorage.setItem('badgeSelector_selectedBadges', JSON.stringify([...selectedBadges]));
    } catch (error) {
        console.error('Failed to save badges:', error);
    }
}

function addAllBadges() {
    AVAILABLE_BADGES.forEach(badge => {
        if (!selectedBadges.has(badge.id)) {
            selectedBadges.add(badge.id);
            addBadge(badge);
        }
    });
    saveBadges();
}

function removeAllBadges() {
    selectedBadges.forEach(badgeId => {
        removeBadge(badgeId);
    });
    selectedBadges.clear();
    saveBadges();
}

function toggleBadge(badgeObj: any) {
    if (selectedBadges.has(badgeObj.id)) {
        selectedBadges.delete(badgeObj.id);
        removeBadge(badgeObj.id);
    } else {
        selectedBadges.add(badgeObj.id);
        addBadge(badgeObj);
    }
    saveBadges();
}

const UserProfileStore = findStoreLazy("UserProfileStore");

function addBadge(badgeObj: any) {
    const original = UserProfileStore.getUserProfile;

    UserProfileStore.getUserProfile = function (userId: string) {
        const userProfile = original.apply(this, arguments);
        const currentUser = UserStore.getCurrentUser();

        if (!userProfile || userId !== currentUser?.id) return userProfile;

        userProfile.badges = Array.isArray(userProfile.badges) ? userProfile.badges : [];

        const { id, description, icon, link } = badgeObj;
        if (!userProfile.badges.some((b: any) => b.id === id)) {
            userProfile.badges.push({
                id: id,
                description: description,
                icon: icon,
                link: link || "#"
            });
        }

        return userProfile;
    };
}

function removeBadge(badgeId: string) {
    const original = UserProfileStore.getUserProfile;

    UserProfileStore.getUserProfile = function (userId: string) {
        const userProfile = original.apply(this, arguments);
        if (userProfile && userId === UserStore.getCurrentUser()?.id) {
            const badgeIndex = userProfile.badges.findIndex((b: any) => b.id === badgeId);
            if (badgeIndex !== -1) {
                userProfile.badges.splice(badgeIndex, 1);
            }
        }
        return userProfile;
    };
}

const UserContext: NavContextMenuPatchCallback = (children, props) => {
    if (!props.user) return;

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser || props.user.id !== currentUser.id) return;

    const hasSelectedBadges = selectedBadges.size > 0;

    children.splice(
        -1,
        0,
        <Menu.MenuItem
            label="Add Badges"
            key="add-badges"
            id="add-badges"
        >
            {}
            <Menu.MenuItem
                key="toggle-all"
                id="toggle-all"
                label={hasSelectedBadges ? "Remove every badges" : "Add every badges"}
                action={hasSelectedBadges ? removeAllBadges : addAllBadges}
            />
            <Menu.MenuSeparator />

            {AVAILABLE_BADGES.map(badge => {
                const isSelected = selectedBadges.has(badge.id);
                return (
                    <Menu.MenuCheckboxItem
                        key={badge.id}
                        id={badge.id}
                        label={
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <img
                                    src={badge.icon}
                                    alt={badge.description}
                                    style={{ width: "16px", height: "16px" }}
                                />
                                {badge.description}
                            </div>
                        }
                        checked={isSelected}
                        action={() => toggleBadge(badge)}
                    />
                );
            })}
        </Menu.MenuItem>
    );
};

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable badge selector",
        default: true,
    }
});

export default definePlugin({
    name: "BadgeSelector",
    description: "Allows you to add Discord badges to your profile through a context menu with image fixer",
    authors: [
        { id: 1263457746829705310n, name: 'fhd' },
        { id: 1147940825330876538n, name: 'Jelly' },
        { id: 1403404140461297816n, name: 'Sami' },
    ],

    settings,

    start() {
        setupBadgeImageFixer();
        loadSavedBadges();
    },

    contextMenus: {
        "user-context": UserContext
    },
});