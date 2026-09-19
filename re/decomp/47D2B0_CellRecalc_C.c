// 0x47d2b0 CellRecalc_C size=AB4

void __thiscall sub_47D2B0(int this, int a2)
{
  __int16 *v3; // edi
  _BYTE *v4; // ebx
  int v5; // ecx
  int v6; // eax
  int v7; // ebp
  int v8; // ecx
  int v9; // eax
  __int16 v10; // dx
  __int16 v11; // cx
  __int16 v12; // dx
  __int16 v13; // dx
  __int16 v14; // dx
  __int16 v15; // dx
  int v16; // ecx
  int v17; // ecx
  int v18; // ebp
  char v19; // al
  __int16 v20; // cx
  __int16 v21; // ax
  __int16 v22; // cx
  __int16 v23; // cx
  __int16 v24; // cx
  __int16 v25; // cx
  _BYTE *v26; // eax
  __int16 v27; // ax
  int v28; // eax
  int v29; // ecx
  int v30; // ebx
  int v31; // eax
  int v32; // ebp
  int v33; // ebx
  _DWORD *v34; // eax
  int v35; // edx
  int v36; // ecx
  int v37; // eax
  void **v38; // eax
  int v39; // eax
  int v40; // ecx
  _WORD *v41; // ebx
  int v42; // eax
  int v43; // eax
  __int16 v44; // dx
  __int16 v45; // cx
  __int16 v46; // dx
  __int16 v47; // dx
  __int16 v48; // dx
  __int16 v49; // dx
  int v50; // eax
  _BYTE *v51; // eax
  int v52; // [esp-8h] [ebp-50h]
  int v53; // [esp+10h] [ebp-38h] BYREF
  int v54; // [esp+14h] [ebp-34h]
  _BYTE *v55; // [esp+18h] [ebp-30h]
  int v56; // [esp+1Ch] [ebp-2Ch] BYREF
  char v57[4]; // [esp+20h] [ebp-28h] BYREF
  int v58[5]; // [esp+24h] [ebp-24h] BYREF
  int v59; // [esp+38h] [ebp-10h]
  char v60[12]; // [esp+3Ch] [ebp-Ch] BYREF

  if ( (_UNKNOWN *)this == &unk_ABDC50 )
    return;
  v3 = (__int16 *)(this + 36);
  v4 = (_BYTE *)(dword_87F850 + 4 * sub_56D3F0(this + 36));
  v55 = v4;
  v5 = dword_87F858 + 10 * sub_56D3F0(this + 36);
  v6 = *(_DWORD *)(this + 68);
  v54 = v5;
  if ( v6 != -1 )
  {
    v7 = *((_DWORD *)dword_A83D84 + v6);
    v8 = *(_DWORD *)(v7 + 664);
    *(_DWORD *)(this + 236) = v8;
    if ( v8 == 4 || v8 == 9 || *(_BYTE *)(v7 + 684) != 0 )
    {
      v9 = *(_DWORD *)(this + 56);
      if ( v9 != 0xFFFF && v9 < dword_A8ED38 )
        *(_BYTE *)(this + 284) = sub_5471B0(*(unsigned __int8 *)(this + 282));
      if ( *(_BYTE *)(this + 284) != 0 && *(_BYTE *)(v7 + 681) != 0 )
      {
        *(_DWORD *)(this + 68) = -1;
        *(_BYTE *)(this + 286) = 0;
      }
      if ( *((_BYTE *)dword_8871E0 + 1636) != 0 )
      {
        v10 = *(_WORD *)(this + 38);
        LOWORD(a2) = *v3;
        HIWORD(a2) = v10 - 1;
        if ( *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283) )
          goto LABEL_19;
        v11 = *v3 - 1;
        HIWORD(a2) = *(_WORD *)(this + 38);
        LOWORD(a2) = v11;
        if ( *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283) )
          goto LABEL_19;
        v12 = *(_WORD *)(this + 38) + 2;
        LOWORD(a2) = *v3 + 2;
        HIWORD(a2) = v12;
        if ( *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283) )
          goto LABEL_19;
        v13 = *(_WORD *)(this + 38) + 1;
        LOWORD(a2) = *v3 + 1;
        HIWORD(a2) = v13;
        if ( *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283)
          || (v14 = *(_WORD *)(this + 38) + 1,
              LOWORD(a2) = *v3 - 1,
              HIWORD(a2) = v14,
              *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283))
          || (v15 = *(_WORD *)(this + 38) - 1,
              LOWORD(a2) = *v3 + 1,
              HIWORD(a2) = v15,
              *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283)) )
        {
LABEL_19:
          if ( *((_BYTE *)dword_8871E0 + 1636) == 2 )
            *(_DWORD *)(this + 236) = 3;
        }
      }
      sub_47CA80(this);
      sub_483C80(this);
      v16 = v54;
      v4[1] = *(_BYTE *)(this + 283);
      *(_BYTE *)(v16 + 8) = *(_BYTE *)(this + 283);
      *v4 = *(_BYTE *)(this + 76);
      return;
    }
  }
  if ( *(_DWORD *)(this + 56) >= dword_A8ED38 )
    *(_DWORD *)(this + 56) = 0xFFFF;
  v17 = *(_DWORD *)(this + 56);
  if ( v17 != 0xFFFF )
  {
    v18 = *((_DWORD *)dword_A8ED2C + v17);
    v52 = *(unsigned __int8 *)(this + 282);
    v53 = v18;
    v19 = sub_544C20(v52, 0);
    if ( *(_BYTE *)(this + 284) != 0 )
    {
      if ( v19 != 0 )
      {
LABEL_40:
        *(_BYTE *)(this + 284) = sub_5471B0(*(unsigned __int8 *)(this + 282));
        sub_47CA80(this);
        if ( *(_DWORD *)(this + 68) == -1 )
          goto LABEL_47;
        if ( sub_5FDD20() != -1 )
        {
          if ( *(_BYTE *)(this + 284) <= 4u )
          {
            if ( *(_DWORD *)(*((_DWORD *)dword_A83D84 + *(_DWORD *)(this + 68)) + 664) == 0 )
              *(_DWORD *)(this + 236) = 5;
          }
          else
          {
            *(_DWORD *)(this + 236) = sub_544BE0(*(unsigned __int8 *)(this + 282));
            *(_DWORD *)(this + 68) = -1;
            *(_BYTE *)(this + 286) = 0;
          }
          goto LABEL_48;
        }
        if ( *(_BYTE *)(*((_DWORD *)dword_A83D84 + *(_DWORD *)(this + 68)) + 684) == 0 )
LABEL_47:
          *(_DWORD *)(this + 236) = sub_544BE0(*(unsigned __int8 *)(this + 282));
LABEL_48:
        if ( *(_DWORD *)(this + 236) == 10 )
        {
          v27 = *(_WORD *)(this + 278);
          if ( v27 < 0 || v27 >= dword_8B4148 )
          {
            if ( (v28 = *(_DWORD *)(this + 56), v29 = dword_AA1054, v28 >= dword_AA1054) && v28 <= dword_AA1054 + 3
              || (v29 = dword_ABB108, v28 >= dword_ABB108) && v28 <= dword_ABB108 + 3
              || (v29 = dword_AA10B4, v28 >= dword_AA10B4) && v28 <= dword_AA10B4 + 3
              || (v29 = dword_ABAD2C, v28 >= dword_ABAD2C) && v28 <= dword_ABAD2C + 3 )
            {
              v30 = v28 - v29;
              if ( v28 - v29 != -1 && operator new(0x1C4u) != nullptr )
                sub_727FD0(this + 36, dword_81CC20[v30]);
            }
          }
        }
        if ( a2 != -1 )
          *(_BYTE *)(this + 283) = a2;
        sub_547150(*(unsigned __int8 *)(this + 282), v57, &v56);
        v31 = *(_DWORD *)(this + 320);
        *(_BYTE *)(this + 285) = (v56 - 30) / 15;
        if ( (v31 & 0x20000) == 0
          && *(_DWORD *)(v18 + 712) != -1
          && *(_DWORD *)(v18 + 724) == *(unsigned __int8 *)(this + 282) )
        {
          v32 = *v3;
          v33 = *(__int16 *)(this + 38);
          v59 = dword_89E7C0 * *(char *)(this + 283);
          v34 = (_DWORD *)sub_6D2360(v60, v53 + 716);
          v35 = v34[1];
          v36 = (v32 << 8) + 128 + *v34;
          v37 = v59 + v34[2];
          v58[0] = v36;
          v58[1] = (v33 << 8) + 128 + v35;
          v58[2] = v37;
          v38 = (void **)operator new(0x1C8u);
          if ( v38 != nullptr )
            v39 = sub_421EA0(v38, *((_DWORD *)dword_8B4154 + *(_DWORD *)(v53 + 712)), (int)v58, 0, -1, 5632, 0, 0);
          else
            v39 = 0;
          v18 = v53;
          v40 = *(_DWORD *)(v53 + 728);
          *(_BYTE *)(v39 + 406) = 1;
          *(_DWORD *)(v39 + 256) = v40;
          *(_BYTE *)(v39 + 407) = 1;
          *(_DWORD *)(this + 320) |= 0x20000u;
        }
        if ( *(_BYTE *)(v18 + 737) != 0 )
        {
          v41 = (_WORD *)sub_547370(v18);
          if ( v41 != nullptr )
          {
            while ( (*v41 != 0x7FFF || v41[1] != 0x7FFF) && *(_DWORD *)v41 != dword_89E748 )
            {
              LOWORD(a2) = *v3 + *v41;
              HIWORD(a2) = v41[1] + *(_WORD *)(this + 38);
              v53 = a2;
              v42 = sub_5657A0(&v53);
              v41 += 2;
              *(_DWORD *)(v42 + 320) |= 0x10000u;
            }
          }
        }
        goto LABEL_82;
      }
      v19 = sub_544C20(*(unsigned __int8 *)(this + 282), 1);
    }
    if ( v19 == 0 )
    {
      *(_DWORD *)(this + 56) = 0xFFFF;
      *(_BYTE *)(this + 282) = 0;
      *(_DWORD *)(this + 236) = 0;
      *(_BYTE *)(this + 284) = 0;
      if ( *((_BYTE *)dword_8871E0 + 1636) != 0 )
      {
        v20 = *(_WORD *)(this + 38) - 1;
        LOWORD(a2) = *v3;
        HIWORD(a2) = v20;
        if ( *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283) )
          goto LABEL_37;
        v21 = *v3 - 1;
        HIWORD(a2) = *(_WORD *)(this + 38);
        LOWORD(a2) = v21;
        if ( *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283) )
          goto LABEL_37;
        v22 = *(_WORD *)(this + 38);
        LOWORD(a2) = *v3 + 2;
        HIWORD(a2) = v22 + 2;
        if ( *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283) )
          goto LABEL_37;
        v23 = *(_WORD *)(this + 38) + 1;
        LOWORD(a2) = *v3 + 1;
        HIWORD(a2) = v23;
        if ( *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283)
          || (v24 = *(_WORD *)(this + 38) + 1,
              LOWORD(a2) = *v3 - 1,
              HIWORD(a2) = v24,
              *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283))
          || (v25 = *(_WORD *)(this + 38) - 1,
              LOWORD(a2) = *v3 + 1,
              HIWORD(a2) = v25,
              *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283)) )
        {
LABEL_37:
          if ( *((_BYTE *)dword_8871E0 + 1636) == 2 && *(_DWORD *)(this + 236) == 0 )
            *(_DWORD *)(this + 236) = 3;
        }
      }
      sub_483C80(this);
      v26 = v55;
      v55[1] = *(_BYTE *)(this + 283);
      *(_BYTE *)(v54 + 8) = *(_BYTE *)(this + 283);
      *v26 = *(_BYTE *)(this + 76);
      return;
    }
    goto LABEL_40;
  }
  if ( v6 == -1 || *(_BYTE *)((v43 = *((_DWORD *)dword_A83D84 + v6)) + 684) != 0 )
    *(_DWORD *)(this + 236) = 0;
  else
    *(_DWORD *)(this + 236) = *(_DWORD *)(v43 + 664);
  *(_BYTE *)(this + 284) = 0;
LABEL_82:
  if ( *((_BYTE *)dword_8871E0 + 1636) != 0 )
  {
    v44 = *(_WORD *)(this + 38);
    LOWORD(a2) = *v3;
    HIWORD(a2) = v44 - 1;
    if ( *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283) )
      goto LABEL_89;
    v45 = *v3 - 1;
    HIWORD(a2) = *(_WORD *)(this + 38);
    LOWORD(a2) = v45;
    if ( *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283) )
      goto LABEL_89;
    v46 = *(_WORD *)(this + 38) + 2;
    LOWORD(a2) = *v3 + 2;
    HIWORD(a2) = v46;
    if ( *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283) )
      goto LABEL_89;
    v47 = *(_WORD *)(this + 38) + 1;
    LOWORD(a2) = *v3 + 1;
    HIWORD(a2) = v47;
    if ( *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283)
      || (v48 = *(_WORD *)(this + 38) + 1,
          LOWORD(a2) = *v3 - 1,
          HIWORD(a2) = v48,
          *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283))
      || (v49 = *(_WORD *)(this + 38) - 1,
          LOWORD(a2) = *v3 + 1,
          HIWORD(a2) = v49,
          *(char *)(this + 283) + 4 <= *(char *)(sub_5657A0(&a2) + 283)) )
    {
LABEL_89:
      if ( *((_BYTE *)dword_8871E0 + 1636) == 2 )
      {
        v50 = *(_DWORD *)(this + 236);
        if ( v50 == 0 || v50 == 2 || v50 == 6 || v50 == 8 )
          *(_DWORD *)(this + 236) = 3;
      }
    }
  }
  sub_483C80(this);
  v51 = v55;
  v55[1] = *(_BYTE *)(this + 283);
  *v51 = *(_BYTE *)(this + 76);
  *(_BYTE *)(v54 + 8) = *(_BYTE *)(this + 283);
}
