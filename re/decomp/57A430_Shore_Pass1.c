// 0x57a430 Shore_Pass1 size=4C4

char __fastcall sub_57A430(int a1, int a2, int i, int a4, int a5)
{
  int v5; // ebp
  int v6; // eax
  int v7; // esi
  int v8; // eax
  char v9; // bl
  unsigned int v10; // eax
  void *v11; // eax
  unsigned int v12; // eax
  void *v13; // eax
  char v14; // al
  unsigned int v15; // eax
  void *v16; // eax
  char v17; // bl
  unsigned int v18; // eax
  void *v19; // eax
  char v20; // al
  unsigned int v21; // eax
  void *v22; // eax
  char v23; // bl
  unsigned int v24; // eax
  void *v25; // eax
  char v26; // al
  unsigned int v27; // eax
  void *v28; // eax
  char v29; // bl
  unsigned int v30; // eax
  void *v31; // eax
  char v32; // al
  int v33; // eax
  int v34; // edx
  char v35; // cl
  int v37; // eax
  unsigned int v38; // eax
  _DWORD *v39; // esi
  int v40; // edx
  int v41; // edi
  int v42; // eax
  int v43; // edx
  char v44; // [esp+13h] [ebp-15h]
  int v45; // [esp+14h] [ebp-14h]
  int v46; // [esp+14h] [ebp-14h]
  int v47; // [esp+14h] [ebp-14h]
  int v48; // [esp+14h] [ebp-14h]
  int v49; // [esp+18h] [ebp-10h]
  int v50; // [esp+18h] [ebp-10h]
  _DWORD v51[3]; // [esp+1Ch] [ebp-Ch] BYREF

  v5 = i;
  v6 = *(_DWORD *)(i + 36);
  v51[2] = a1;
  v44 = 0;
  i = v6;
  v7 = sub_58C2A0(&i);
  *(_DWORD *)(v7 + 64) = sub_57B210(v5, 2);
  v8 = sub_57B210(v5, 0);
  v9 = v8;
  i = v8;
  if ( v8 > 0 )
  {
    if ( v8 == 11 || v8 == 26 )
      v44 = 1;
    if ( (v8 & 0xA0) == 0xA0 && (v8 & 0x11) == 0
      || (v8 & 0x82) == 0x82 && (v8 & 0x44) == 0
      || (v8 & 0xA) == 0xA && (v8 & 0x11) == 0
      || (v8 & 0x28) == 0x28 && (v8 & 0x44) == 0 )
    {
      v44 = 1;
    }
    if ( (v8 & 0x20) != 0 )
    {
      v49 = *(_DWORD *)(v5 + 36);
      v10 = (__int16)(v49 + 1) + (SHIWORD(v49) << 9);
      if ( v10 >= 0x40000 || (v11 = *(void **)(dword_87F924 + 4 * v10)) == nullptr )
      {
        v11 = &unk_ABDC50;
        LOWORD(v45) = v49 + 1;
        HIWORD(v45) = HIWORD(*(_DWORD *)(v5 + 36));
        dword_ABDC74 = v45;
      }
      v51[0] = sub_57B210(v11, 0);
      v50 = *(_DWORD *)(v5 + 36);
      v12 = (__int16)(v50 + 2) + (SHIWORD(v50) << 9);
      if ( v12 >= 0x40000 || (v13 = *(void **)(dword_87F924 + 4 * v12)) == nullptr )
      {
        LOWORD(v46) = v50 + 2;
        HIWORD(v46) = HIWORD(*(_DWORD *)(v5 + 36));
        dword_ABDC74 = v46;
        v13 = &unk_ABDC50;
      }
      v14 = sub_57B210(v13, 0);
      if ( (v51[0] & 2) != 0 || (v14 & 2) != 0 )
        v44 = 1;
    }
    if ( (v9 & 2) != 0 )
    {
      v51[0] = *(_DWORD *)(v5 + 36);
      HIWORD(v47) = HIWORD(v51[0]);
      v15 = (__int16)(LOWORD(v51[0]) - 1) + (SHIWORD(v51[0]) << 9);
      if ( v15 >= 0x40000 || (v16 = *(void **)(dword_87F924 + 4 * v15)) == nullptr )
      {
        LOWORD(v47) = LOWORD(v51[0]) - 1;
        dword_ABDC74 = v47;
        v16 = &unk_ABDC50;
      }
      v17 = sub_57B210(v16, 0);
      v51[0] = *(_DWORD *)(v5 + 36);
      HIWORD(v48) = HIWORD(v51[0]);
      v18 = (__int16)(LOWORD(v51[0]) - 2) + (SHIWORD(v51[0]) << 9);
      if ( v18 >= 0x40000 || (v19 = *(void **)(dword_87F924 + 4 * v18)) == nullptr )
      {
        LOWORD(v48) = LOWORD(v51[0]) - 2;
        dword_ABDC74 = v48;
        v19 = &unk_ABDC50;
      }
      v20 = sub_57B210(v19, 0);
      if ( (v17 & 0x20) != 0 || (v20 & 0x20) != 0 )
        v44 = 1;
      v9 = i;
    }
    if ( (v9 & 8) != 0 )
    {
      v51[0] = *(_DWORD *)(v5 + 36);
      v21 = SLOWORD(v51[0]) + ((__int16)(HIWORD(v51[0]) - 1) << 9);
      if ( v21 >= 0x40000 || (v22 = *(void **)(dword_87F924 + 4 * v21)) == nullptr )
      {
        dword_ABDC74 = v51[0] - 0x10000;
        v22 = &unk_ABDC50;
      }
      v23 = sub_57B210(v22, 0);
      v51[0] = *(_DWORD *)(v5 + 36);
      v24 = SLOWORD(v51[0]) + ((__int16)(HIWORD(v51[0]) - 2) << 9);
      if ( v24 >= 0x40000 || (v25 = *(void **)(dword_87F924 + 4 * v24)) == nullptr )
      {
        dword_ABDC74 = v51[0] - 0x20000;
        v25 = &unk_ABDC50;
      }
      v26 = sub_57B210(v25, 0);
      if ( v23 < 0 || v26 < 0 )
        v44 = 1;
      v9 = i;
    }
    if ( v9 < 0 )
    {
      v51[0] = *(_DWORD *)(v5 + 36);
      v27 = SLOWORD(v51[0]) + ((__int16)(HIWORD(v51[0]) + 1) << 9);
      if ( v27 >= 0x40000 || (v28 = *(void **)(dword_87F924 + 4 * v27)) == nullptr )
      {
        dword_ABDC74 = v51[0] + 0x10000;
        v28 = &unk_ABDC50;
      }
      v29 = sub_57B210(v28, 0);
      v51[0] = *(_DWORD *)(v5 + 36);
      v30 = SLOWORD(v51[0]) + ((__int16)(HIWORD(v51[0]) + 2) << 9);
      if ( v30 >= 0x40000 || (v31 = *(void **)(dword_87F924 + 4 * v30)) == nullptr )
      {
        dword_ABDC74 = v51[0] + 0x20000;
        v31 = &unk_ABDC50;
      }
      v32 = sub_57B210(v31, 0);
      if ( (v29 & 8) != 0 || (v32 & 8) != 0 )
        v44 = 1;
      v9 = i;
    }
    if ( (v9 & 0x88) == 0x88 || (v9 & 0x22) == 0x22 || v44 != 0 )
    {
      i = *(_DWORD *)(v5 + 36);
      v33 = sub_5A00C0(&i);
      v34 = a4;
      v35 = a5;
      if ( v33 > 0 && v33 != a4 && (_BYTE)a5 == 0 )
        return 0;
      v37 = dword_AA0738;
      *(_BYTE *)(v5 + 282) = 0;
      *(_DWORD *)(v5 + 56) = v37;
      i = *(_DWORD *)(v5 + 36);
      if ( v35 != 0 )
        sub_5A0090(&i, 0);
      else
        sub_5A0090(&i, v34);
      v38 = 0;
      for ( i = 0; i < 8; ++i )
      {
        v39 = sub_481810((_DWORD *)v5, v38);
        v40 = v39[9];
        v51[0] = v40;
        v41 = SHIWORD(v40) + (__int16)v40;
        if ( v41 > dword_ABED04
          && SLOWORD(v51[0]) - SHIWORD(v51[0]) < dword_ABED04
          && SHIWORD(v51[0]) - SLOWORD(v51[0]) < dword_ABED04
          && v41 <= dword_ABED08 )
        {
          v51[0] = v40;
          v42 = sub_58C2A0(v51);
          v43 = a5;
          *(_DWORD *)(v42 + 64) = -1;
          sub_57A430(v39, a4, v43);
        }
        v38 = i + 1;
      }
    }
  }
  return 1;
}
