// 0x57b440 Shore_StampTile size=350

char __stdcall sub_57B440(int a1, int a2, char a3, int a4, _BYTE *a5, char a6)
{
  int v6; // ebp
  int v7; // edi
  int v8; // ecx
  __int16 v9; // ax
  int v10; // ecx
  int v11; // eax
  int v12; // edx
  unsigned int v13; // eax
  _DWORD *v14; // esi
  int v15; // ebx
  int v16; // ebp
  int v17; // eax
  int v18; // edi
  int v19; // eax
  int v20; // ecx
  __int64 v21; // rax
  int v22; // eax
  int v23; // edi
  int v24; // ebp
  int v25; // eax
  int v26; // ecx
  int v28; // eax
  int v29; // [esp+10h] [ebp-1Ch]
  int v30; // [esp+14h] [ebp-18h]
  int v31; // [esp+18h] [ebp-14h] BYREF
  int v32; // [esp+1Ch] [ebp-10h]
  int v33; // [esp+20h] [ebp-Ch]
  int v34; // [esp+24h] [ebp-8h]
  int v35; // [esp+28h] [ebp-4h]

  if ( (*(int (__thiscall **)(int))(*(_DWORD *)dword_880990 + 44))(dword_880990) != 18 )
    return 0;
  if ( a6 != 0 )
    a4 = 0;
  v6 = dword_880990;
  v29 = dword_880990;
  v34 = (*(int (__thiscall **)(int))(*(_DWORD *)dword_880990 + 156))(dword_880990);
  if ( v34 == 0 )
    return 0;
  v30 = 0;
  if ( *(int *)(v6 + 744) <= 0 )
    return 1;
  v7 = dword_87F8DC;
  while ( 1 )
  {
    v8 = *(_DWORD *)(v6 + 740);
    v9 = 0;
    v32 = 0;
    if ( v8 > 0 )
      break;
LABEL_39:
    if ( ++v30 >= *(_DWORD *)(v6 + 744) )
      return 1;
  }
  while ( 1 )
  {
    LOWORD(v33) = v9 + dword_88095C;
    v10 = (__int16)(v9 + dword_88095C);
    HIWORD(v33) = HIWORD(dword_88095C) + v30;
    v11 = (__int16)(HIWORD(dword_88095C) + v30);
    v31 = v33;
    v12 = (__int16)v10 + v11;
    if ( v12 > v7 && v10 - v11 < v7 && v11 - v10 < v7 && v12 <= v7 + 2 * dword_87F8E0 )
    {
      v13 = v10 + (v11 << 9);
      if ( v13 >= 0x40000 || (v14 = *(_DWORD **)(dword_87F924 + 4 * v13)) == nullptr )
      {
        dword_ABDC74 = v33;
        v14 = &unk_ABDC50;
      }
      v15 = v32 + v30 * *(_DWORD *)(v6 + 740);
      v35 = *(_DWORD *)(v34 + 4 * v15 + 16);
      v16 = v35;
      if ( v35 != 0 )
        break;
LABEL_37:
      v6 = v29;
    }
    v26 = *(_DWORD *)(v6 + 740);
    v9 = ++v32;
    if ( v32 >= v26 )
      goto LABEL_39;
  }
  v17 = sub_5A00C0((__int16 *)&v31);
  if ( a6 != 0 )
  {
    v17 = 0;
LABEL_18:
    v18 = a4;
    goto LABEL_19;
  }
  if ( v17 <= 0 )
    goto LABEL_18;
  v18 = a4;
  if ( v17 == a4 )
    goto LABEL_20;
  if ( a4 != -1 )
  {
    v23 = v14[14] - dword_ABAD28;
    v24 = *(_DWORD *)(v29 + 660) - dword_ABAD28;
    if ( !sub_486380(v14) )
    {
      if ( v23 < 0 || v24 < 0 || v23 > 41 || v24 > 41 || dword_82A7F4[v23] != dword_82A7F4[v24] )
      {
        *a5 = 0;
        return 0;
      }
      return 1;
    }
    sub_5A0090((__int16 *)&v31, a4);
    v16 = v35;
    goto LABEL_32;
  }
LABEL_19:
  if ( v17 == v18 )
  {
LABEL_20:
    v19 = v14[14] - dword_ABAD28;
    v20 = *(_DWORD *)(v29 + 660) - dword_ABAD28;
    if ( v19 >= 0 && v20 >= 0 && v19 <= 41 && v20 <= 41 )
    {
      v21 = dword_82A89C[v19] - dword_82A89C[v20];
      v22 = (HIDWORD(v21) ^ v21) - HIDWORD(v21);
      if ( v22 >= 3 && v22 <= 5 )
      {
        *a5 = 0;
        return 0;
      }
    }
    goto LABEL_32;
  }
  if ( !sub_486380(v14) )
  {
    if ( v18 != -1 )
      goto LABEL_58;
    goto LABEL_36;
  }
  sub_5A0090((__int16 *)&v31, v18);
LABEL_32:
  if ( sub_486380(v14) || (v25 = v14[14]) >= a1 && v25 <= a2 )
  {
    v14[14] = *(_DWORD *)(v29 + 660);
    *((_BYTE *)v14 + 282) = v15;
    *((_BYTE *)v14 + 283) = a3 + *(_BYTE *)(v16 + 40);
LABEL_36:
    v7 = dword_87F8DC;
    goto LABEL_37;
  }
  if ( sub_4865B0(v14) && (unsigned __int8)sub_578D80(*(_DWORD *)(v29 + 660), v15) != 0
    || (v28 = *(_DWORD *)(v29 + 660)) >= dword_ABAD28
    && v28 < dword_ABAD28 + 42
    && (unsigned __int8)sub_4863D0(v14) != 0 )
  {
LABEL_58:
    *a5 = 0;
  }
  return 0;
}
