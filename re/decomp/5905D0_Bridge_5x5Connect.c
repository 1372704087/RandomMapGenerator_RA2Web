// 0x5905d0 Bridge_5x5Connect size=398

char __thiscall sub_5905D0(int this)
{
  int v1; // esi
  int v2; // eax
  int v3; // ecx
  int v4; // edi
  _DWORD *v5; // ebx
  int v6; // ebp
  int v7; // eax
  _DWORD *v8; // edx
  int v9; // edx
  int v10; // eax
  int v11; // edx
  _DWORD *v12; // ecx
  int v13; // eax
  int v14; // ecx
  int v15; // eax
  int v16; // ecx
  int v17; // ebx
  int v18; // edi
  int v19; // eax
  int v20; // edx
  char *v21; // ecx
  int v22; // esi
  int v23; // ebp
  int v24; // eax
  unsigned int v25; // eax
  int v26; // ecx
  int v27; // eax
  int v28; // edi
  int v29; // eax
  char *v30; // ecx
  int v31; // ebp
  int v32; // edi
  unsigned int v33; // esi
  unsigned int v34; // eax
  int v35; // edx
  float v37; // [esp+0h] [ebp-58h]
  _DWORD *v39; // [esp+18h] [ebp-40h]
  int v40; // [esp+18h] [ebp-40h]
  int v41; // [esp+1Ch] [ebp-3Ch] BYREF
  int v42; // [esp+20h] [ebp-38h]
  int v43; // [esp+24h] [ebp-34h]
  int v44; // [esp+28h] [ebp-30h]
  int v45; // [esp+2Ch] [ebp-2Ch]
  __int64 v46; // [esp+30h] [ebp-28h]
  __int64 v47; // [esp+38h] [ebp-20h]
  __int64 v48; // [esp+40h] [ebp-18h]
  __int64 v49; // [esp+48h] [ebp-10h]
  double v50; // [esp+50h] [ebp-8h]

  v1 = this;
  LOBYTE(v2) = *(_BYTE *)(this + 20);
  if ( (_BYTE)v2 != 0 )
  {
    v3 = *(_DWORD *)(this + 4);
    v4 = *(_DWORD *)(v3 + 16);
    LOBYTE(v2) = v4 - 1;
    if ( v4 - 1 > 0 )
    {
      v5 = dword_ABDF94;
      v6 = dword_ABDFA0;
      v42 = 1;
      v41 = 0;
      while ( 1 )
      {
        v7 = 0;
        if ( v6 <= 0 )
        {
LABEL_9:
          v39 = nullptr;
        }
        else
        {
          v8 = v5;
          while ( *(_DWORD *)(*v8 + 8) != *(_DWORD *)(*(_DWORD *)(v3 + 4) + v41) )
          {
            ++v7;
            ++v8;
            if ( v7 >= v6 )
            {
              v5 = dword_ABDF94;
              v1 = this;
              goto LABEL_9;
            }
          }
          v5 = dword_ABDF94;
          v1 = this;
          v39 = *((_DWORD **)dword_ABDF94 + v7);
        }
        if ( *(int *)(v39[1] + 16) <= 1 && (int)v39[3] <= 50 )
          goto LABEL_28;
        v9 = v42;
        v43 = v42;
        if ( v42 < v4 )
          break;
LABEL_29:
        v41 += 4;
        v3 = *(_DWORD *)(v1 + 4);
        v42 = v9 + 1;
        v4 = *(_DWORD *)(v3 + 16);
        LOBYTE(v2) = v4 - 1;
        if ( v9 >= v4 - 1 )
          return v2;
      }
      do
      {
        v10 = 0;
        if ( v6 <= 0 )
        {
LABEL_20:
          v13 = 0;
        }
        else
        {
          v11 = *(_DWORD *)(*(_DWORD *)(v3 + 4) + 4 * v9);
          v12 = v5;
          while ( *(_DWORD *)(*v12 + 8) != v11 )
          {
            ++v10;
            ++v12;
            if ( v10 >= v6 )
              goto LABEL_20;
          }
          v13 = v5[v10];
        }
        if ( (*(int *)(*(_DWORD *)(v13 + 4) + 16) > 1 || *(int *)(v13 + 12) > 50) && *(_BYTE *)(v13 + 20) == 0 )
        {
          v14 = v39[4];
          if ( *(_DWORD *)(v13 + 16) == v14 && v14 == *(_DWORD *)(v1 + 16) )
          {
            sub_58F2C0(v39, v13);
            v5 = dword_ABDF94;
            v6 = dword_ABDFA0;
          }
        }
        v3 = *(_DWORD *)(v1 + 4);
        v9 = v43 + 1;
        v15 = *(_DWORD *)(v3 + 16);
        v43 = v9;
      }
      while ( v9 < v15 );
LABEL_28:
      v9 = v42;
      goto LABEL_29;
    }
  }
  else
  {
    v16 = *(_DWORD *)(this + 4);
    v17 = 0;
    v42 = 0;
    if ( *(int *)(v16 + 16) > 0 )
    {
      v18 = dword_ABDFA0;
      do
      {
        v19 = 0;
        if ( v18 <= 0 )
        {
LABEL_37:
          v22 = 0;
        }
        else
        {
          v20 = *(_DWORD *)(*(_DWORD *)(v16 + 4) + 4 * v42);
          v21 = (char *)dword_ABDF94;
          while ( *(_DWORD *)(*(_DWORD *)v21 + 8) != v20 )
          {
            ++v19;
            v21 += 4;
            if ( v19 >= v18 )
              goto LABEL_37;
          }
          v22 = *((_DWORD *)dword_ABDF94 + v19);
        }
        v23 = this;
        if ( *(_DWORD *)(v22 + 8) > *(_DWORD *)(this + 8) && *(_DWORD *)(v22 + 16) != *(_DWORD *)(this + 16) )
        {
          v40 = 0;
          do
          {
            v46 = (unsigned int)sub_65C780(&unk_ABE890);
            v24 = sub_7C5F00((double)v46 * 0.00000002351589501451605);
          }
          while ( (unsigned int)v24 > 0x64 );
          if ( v24 >= dword_ABE044 )
          {
            v25 = 0;
          }
          else
          {
            do
            {
              v47 = (unsigned int)sub_65C780(&unk_ABE890);
              v25 = sub_7C5F00((double)v47 * 4.656612874161595e-10 + 1.0);
            }
            while ( v25 > 2 );
          }
          v26 = *(_DWORD *)(this + 16);
          v45 = v25 + 1;
          v27 = *(_DWORD *)(v22 + 16);
          v44 = 0;
          if ( v27 <= v26 )
            v28 = *(_DWORD *)(this + 8);
          else
            v28 = *(_DWORD *)(v22 + 8);
          if ( v27 <= v26 )
            v43 = *(_DWORD *)(v22 + 8);
          else
            v43 = *(_DWORD *)(this + 8);
          v29 = 0;
          if ( dword_ABDFA0 <= 0 )
          {
LABEL_57:
            v31 = 0;
          }
          else
          {
            v30 = (char *)dword_ABDF94;
            while ( *(_DWORD *)(*(_DWORD *)v30 + 8) != v28 )
            {
              ++v29;
              v30 += 4;
              if ( v29 >= dword_ABDFA0 )
                goto LABEL_57;
            }
            v31 = *((_DWORD *)dword_ABDF94 + v29);
          }
          v32 = sub_58D410(v31);
          if ( v45 <= 0 )
            goto LABEL_66;
          do
          {
            if ( v17 >= 100 )
              break;
            v33 = *(_DWORD *)(v32 + 16) - 1;
            v48 = *(unsigned int *)(v32 + 16);
            v50 = (double)v48;
            do
            {
              v49 = (unsigned int)sub_65C780(&unk_ABE890);
              v34 = sub_7C5F00((double)v49 * v50 * 2.328306437080797e-10);
            }
            while ( v34 > v33 );
            v41 = *(_DWORD *)(*(_DWORD *)(v32 + 4) + 4 * v34);
            if ( (unsigned __int8)sub_578460(&v41, 1) != 0 )
            {
              v37 = (double)v44 * 0.0099999998;
              v40 += (unsigned __int8)sub_590970((int)&v41, v43, v37) != 0;
            }
            v44 = ++v17;
          }
          while ( v40 < v45 );
          if ( v40 == 0 )
LABEL_66:
            *(_BYTE *)(this + 27) = 0;
          if ( v32 != 0 )
            (**(void (__thiscall ***)(int, int))v32)(v32, 1);
          v18 = dword_ABDFA0;
          v23 = this;
          v17 = 0;
        }
        v16 = *(_DWORD *)(v23 + 4);
        v2 = v42 + 1;
        v35 = *(_DWORD *)(v16 + 16);
        v42 = v2;
      }
      while ( v2 < v35 );
    }
  }
  return v2;
}
