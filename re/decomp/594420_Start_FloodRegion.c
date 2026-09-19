// 0x594420 Start_FloodRegion size=2D6

void __fastcall sub_594420(int a1, int a2, int a3)
{
  _DWORD *v4; // eax
  _DWORD *v5; // ebx
  int v6; // ebp
  int v7; // eax
  int v8; // eax
  int v9; // edx
  int v10; // eax
  _DWORD *v11; // ecx
  int v12; // eax
  int v13; // edi
  int v14; // eax
  int v15; // ecx
  int v16; // eax
  int v17; // edx
  int v18; // ebx
  int v19; // eax
  _DWORD *v20; // eax
  int v21; // edx
  int v22; // ecx
  _DWORD *v23; // esi
  char *v24; // edi
  int v25; // eax
  int v26; // [esp+10h] [ebp-30h]
  _DWORD *v27; // [esp+14h] [ebp-2Ch]
  int v28; // [esp+18h] [ebp-28h]
  int v29; // [esp+1Ch] [ebp-24h]
  int v30; // [esp+20h] [ebp-20h] BYREF
  int v31; // [esp+24h] [ebp-1Ch]
  void **v32; // [esp+28h] [ebp-18h] BYREF
  void *Block; // [esp+2Ch] [ebp-14h]
  int v34; // [esp+30h] [ebp-10h]
  char v35; // [esp+35h] [ebp-Bh]
  int v36; // [esp+38h] [ebp-8h]
  int v37; // [esp+3Ch] [ebp-4h]

  v31 = a2;
  v4 = operator new(0x50u);
  if ( v4 != nullptr )
    v5 = sub_58BF70(v4, *(_DWORD *)(a1 + 36));
  else
    v5 = nullptr;
  v6 = v5[2];
  v27 = v5;
  v29 = v6;
  sub_42FCB0(0, 0);
  v7 = *(__int16 *)(a1 + 36) + dword_89C2DC * *(__int16 *)(a1 + 38);
  v32 = &DynamicVectorClass<Cell>::`vftable';
  v36 = 0;
  v37 = 20000;
  *((_DWORD *)dword_ABED10 + 20 * v7 + 15) = v6;
  if ( v36 < v34
    || (v35 != 0 || v34 == 0)
    && v37 > 0
    && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v32[2])(&v32, v37 + v34, 0) != 0 )
  {
    v8 = v36++;
    *((_DWORD *)Block + v8) = *(_DWORD *)(a1 + 36);
  }
  v9 = v36;
  v10 = v36;
  if ( v36 > 0 )
  {
    while ( 1 )
    {
      v11 = Block;
      v12 = v10 - 1;
      v13 = *((_DWORD *)Block + v12);
      v26 = v13;
      if ( v12 < v9 )
      {
        v36 = v9 - 1;
        if ( v12 < v9 - 1 )
        {
          while ( 1 )
          {
            v11[v12] = v11[v12 + 1];
            if ( ++v12 >= v36 )
              break;
            v11 = Block;
          }
        }
      }
      *((_DWORD *)dword_ABED10 + 20 * (__int16)v13 + 20 * dword_89C2DC * SHIWORD(v13) + 14) = v6;
      ++v5[3];
      v14 = v5[12];
      if ( v5[14] < v14
        || (*((_BYTE *)v5 + 53) != 0 || v14 == 0)
        && (v15 = v5[15]) > 0
        && (*(unsigned __int8 (__thiscall **)(_DWORD *, int, _DWORD))(v5[10] + 8))(v5 + 10, v14 + v15, 0) != 0 )
      {
        v16 = v5[14];
        v17 = v5[11];
        v5[14] = v16 + 1;
        *(_DWORD *)(v17 + 4 * v16) = v13;
      }
      v18 = 0;
      while ( 1 )
      {
        v19 = v18 & 7;
        LOWORD(v28) = v13 + LOWORD(dword_89F688[v19]);
        HIWORD(v28) = HIWORD(v26) + HIWORD(dword_89F688[v19]);
        v30 = v28;
        v20 = sub_5657A0(&stru_87F7E8, (__int16 *)&v30);
        v21 = *((__int16 *)v20 + 18);
        v22 = *((__int16 *)v20 + 19);
        v23 = v20 + 9;
        if ( v21 + v22 > dword_ABED04
          && v21 - v22 < dword_ABED04
          && v22 - v21 < dword_ABED04
          && v21 + v22 <= dword_ABED08 )
        {
          v24 = (char *)dword_ABED10 + 80 * *((__int16 *)v20 + 18) + 80 * dword_89C2DC * *((__int16 *)v20 + 19);
          if ( v20[19] == 0 && sub_56D230(v23, v31, 0) == a3 && *((_DWORD *)v24 + 15) == -1 )
          {
            *((_DWORD *)v24 + 15) = v29;
            if ( v36 < v34
              || (v35 != 0 || v34 == 0)
              && v37 > 0
              && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v32[2])(&v32, v37 + v34, 0) != 0 )
            {
              v25 = v36++;
              *((_DWORD *)Block + v25) = *v23;
            }
          }
        }
        if ( ++v18 >= 8 )
          break;
        LOWORD(v13) = v26;
      }
      v9 = v36;
      v10 = v36;
      if ( v36 <= 0 )
        break;
      v5 = v27;
      v6 = v29;
    }
  }
  v32 = &VectorClass<Cell>::`vftable';
  if ( Block != nullptr && v35 != 0 )
    operator delete(Block);
}
