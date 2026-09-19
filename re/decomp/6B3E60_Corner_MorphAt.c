// 0x6b3e60 Corner_MorphAt size=29D

char __fastcall sub_6B3E60(int a1, char a2, int a3, unsigned int a4)
{
  int v4; // ebx
  unsigned int v5; // ecx
  int v6; // edx
  int v7; // ebp
  int v8; // esi
  int v9; // eax
  int v10; // edi
  char *v11; // esi
  int v12; // ecx
  bool v13; // sf
  int v14; // eax
  int v15; // ebx
  int v16; // eax
  int *v17; // edx
  int v19; // edx
  int v20; // eax
  int v21; // eax
  int v22; // ecx
  int v24; // [esp+14h] [ebp-14h]
  int v25; // [esp+18h] [ebp-10h]
  unsigned int v26; // [esp+1Ch] [ebp-Ch]
  int v28; // [esp+24h] [ebp-4h]
  int v29; // [esp+2Ch] [ebp+4h]
  int v30; // [esp+30h] [ebp+8h]

  v4 = a1;
  dword_B0B660 = 0;
  if ( dword_B0B654 != nullptr && byte_B0B65D != 0 )
  {
    operator delete(dword_B0B654);
    dword_B0B654 = nullptr;
  }
  v5 = a4 & 3 | (2 * (a4 & 4)) | (a4 >> 1) & 4;
  v6 = (__int16)a3 - dword_8759A8;
  dword_B0B658 = 0;
  byte_B0B65D = 0;
  v7 = SHIWORD(a3) - dword_8759AC;
  v26 = v5;
  v8 = v7 + 2;
  v25 = v6;
  v24 = 1;
  v30 = v7;
  v28 = v7 + 2;
  if ( __OFSUB__(v7, v7 + 2) )
    return 1;
  v9 = v6 + 2;
  while ( 1 )
  {
    v10 = v6;
    v29 = v6;
    if ( v6 < v9 )
      break;
LABEL_27:
    v30 = ++v7;
    if ( v7 >= v8 )
      return 1;
  }
  while ( 1 )
  {
    if ( (v5 & v24) == 0 )
      goto LABEL_25;
    v11 = (char *)dword_B0B6EC + 8 * v10 + 8 * v7 * dword_8759A4;
    if ( v11[4] != 0 )
      break;
    v12 = 15 * v4;
    v13 = 15 * v4 + *(_DWORD *)v11 < 0;
    v14 = 15 * v4 + *(_DWORD *)v11;
    *(_DWORD *)v11 = v14;
    if ( v13 || v14 > 180 )
    {
      *(_DWORD *)v11 = v14 - v12;
    }
    else
    {
      v15 = v14 - v12;
      if ( dword_B0B660 < dword_B0B658
        || (byte_B0B65D != 0 || dword_B0B658 == 0)
        && dword_B0B664 > 0
        && (*(unsigned __int8 (__thiscall **)(int *, int, _DWORD))(dword_B0B650 + 8))(
             &dword_B0B650,
             dword_B0B658 + dword_B0B664,
             0) != 0 )
      {
        v16 = dword_B0B660++;
        v17 = (int *)((char *)dword_B0B654 + 12 * v16);
        *v17 = v10;
        v17[1] = v7;
        v17[2] = v15;
      }
      v7 = v30;
      v10 = v29;
    }
    v4 = a1;
    v11[5] = 1;
    if ( sub_6B3A80(a1, a2, v10, v7) == 0 && a2 == 0 )
    {
      if ( dword_B0B660 - 1 >= 0 )
      {
        v19 = dword_B0B660;
        v20 = 12 * (dword_B0B660 - 1);
        do
        {
          v20 -= 12;
          --v19;
          *((_DWORD *)dword_B0B6EC
          + 2 * *(_DWORD *)((char *)dword_B0B654 + v20 + 12)
          + 2 * dword_8759A4 * *(_DWORD *)((char *)dword_B0B654 + v20 + 16)) = *(_DWORD *)((char *)dword_B0B654
                                                                                         + v20
                                                                                         + 20);
        }
        while ( v19 != 0 );
      }
      goto LABEL_36;
    }
    v6 = v25;
    v5 = v26;
LABEL_25:
    v9 = v6 + 2;
    ++v10;
    v24 *= 2;
    v29 = v10;
    if ( v10 >= v6 + 2 )
    {
      v8 = v28;
      goto LABEL_27;
    }
  }
  if ( a2 != 0 )
    goto LABEL_25;
  if ( dword_B0B660 - 1 >= 0 )
  {
    v21 = 12 * (dword_B0B660 - 1);
    v22 = dword_B0B660;
    do
    {
      v21 -= 12;
      --v22;
      *((_DWORD *)dword_B0B6EC
      + 2 * *(_DWORD *)((char *)dword_B0B654 + v21 + 12)
      + 2 * dword_8759A4 * *(_DWORD *)((char *)dword_B0B654 + v21 + 16)) = *(_DWORD *)((char *)dword_B0B654 + v21 + 20);
    }
    while ( v22 != 0 );
  }
LABEL_36:
  dword_B0B660 = 0;
  if ( dword_B0B654 != nullptr && byte_B0B65D != 0 )
  {
    operator delete(dword_B0B654);
    dword_B0B654 = nullptr;
  }
  dword_B0B658 = 0;
  byte_B0B65D = 0;
  return 0;
}
